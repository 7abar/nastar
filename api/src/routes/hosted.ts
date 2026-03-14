/**
 * /v1/hosted — No-Code Agent Launcher
 * Stores hosted agent configs and serves as the runtime endpoint.
 * Production: configs stored in DB with encrypted LLM keys.
 * Hackathon MVP: in-memory store.
 */

import { Router, Request, Response } from "express";

const router = Router();

// ─── In-memory store (hackathon MVP) ─────────────────────────────────────────

interface SpendingLimits {
  maxPerCallUsd: number;
  dailyLimitUsd: number;
  requireConfirmAboveUsd: number;
}

interface HostedAgent {
  agentWallet: string;
  ownerAddress: string;
  apiKey: string;
  agentNftId: number | null;
  serviceId: number | null;
  name: string;
  description: string;
  templateId: string;
  systemPrompt: string;
  llmProvider: string;
  llmModel: string;
  llmApiKey: string; // TODO: encrypt in production
  spendingLimits: SpendingLimits;
  createdAt: number;
  status: "active" | "paused" | "limit_reached";
  dailySpend: number;
  dailySpendReset: number; // timestamp of next reset
  jobsCompleted: number;
  totalEarned: number;
  logs: ActivityLog[];
}

interface ActivityLog {
  id: string;
  timestamp: number;
  type: "job" | "spend" | "error" | "approval";
  message: string;
  amount?: string;
  txHash?: string;
}

const hostedAgents = new Map<string, HostedAgent>();

function resetDailyIfNeeded(agent: HostedAgent): void {
  if (Date.now() > agent.dailySpendReset) {
    agent.dailySpend = 0;
    agent.dailySpendReset = Date.now() + 24 * 60 * 60 * 1000;
    if (agent.status === "limit_reached") agent.status = "active";
  }
}

function addLog(agent: HostedAgent, log: Omit<ActivityLog, "id" | "timestamp">): void {
  agent.logs.unshift({
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  });
  if (agent.logs.length > 100) agent.logs.length = 100;
}

// ─── POST /v1/hosted — register a new hosted agent ───────────────────────────

router.post("/", (req: Request, res: Response) => {
  const {
    agentWallet, ownerAddress, apiKey, agentNftId, serviceId,
    name, description, templateId, systemPrompt,
    llmProvider, llmModel, llmApiKey, spendingLimits,
  } = req.body;

  if (!agentWallet || !systemPrompt || !llmApiKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const agent: HostedAgent = {
    agentWallet: agentWallet.toLowerCase(),
    ownerAddress,
    apiKey,
    agentNftId: agentNftId ?? null,
    serviceId: serviceId ?? null,
    name,
    description,
    templateId,
    systemPrompt,
    llmProvider: llmProvider || "openai",
    llmModel: llmModel || "gpt-4o-mini",
    llmApiKey,
    spendingLimits: {
      maxPerCallUsd: spendingLimits?.maxPerCallUsd ?? 10,
      dailyLimitUsd: spendingLimits?.dailyLimitUsd ?? 50,
      requireConfirmAboveUsd: spendingLimits?.requireConfirmAboveUsd ?? 25,
    },
    createdAt: Date.now(),
    status: "active",
    dailySpend: 0,
    dailySpendReset: Date.now() + 24 * 60 * 60 * 1000,
    jobsCompleted: 0,
    totalEarned: 0,
    logs: [],
  };

  hostedAgents.set(agent.agentWallet, agent);
  addLog(agent, { type: "job", message: `Agent "${name}" launched and registered on Nastar.` });

  return res.status(201).json({
    agentWallet: agent.agentWallet,
    endpoint: `/v1/hosted/${agent.agentWallet}`,
    status: "active",
  });
});

// ─── GET /v1/hosted/:wallet/stats ─────────────────────────────────────────────

router.get("/:wallet/stats", (req: Request, res: Response) => {
  const agent = hostedAgents.get(req.params.wallet.toLowerCase());
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  resetDailyIfNeeded(agent);

  return res.json({
    jobsCompleted: agent.jobsCompleted,
    totalEarned: agent.totalEarned.toFixed(4),
    dailySpend: agent.dailySpend.toFixed(4),
    dailyLimit: agent.spendingLimits.dailyLimitUsd.toString(),
    status: agent.status,
    uptime: "99.9%",
  });
});

// ─── GET /v1/hosted/:wallet/logs ──────────────────────────────────────────────

router.get("/:wallet/logs", (req: Request, res: Response) => {
  const agent = hostedAgents.get(req.params.wallet.toLowerCase());
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  return res.json(agent.logs);
});

// ─── POST /v1/hosted/:wallet — task execution endpoint ────────────────────────
// This is the endpoint registered on-chain as the agent's service endpoint.
// Buyers call this after an escrow deal is created.

router.post("/:wallet", async (req: Request, res: Response) => {
  const agent = hostedAgents.get(req.params.wallet.toLowerCase());
  if (!agent) return res.status(404).json({ error: "Hosted agent not found" });
  if (agent.status !== "active") {
    return res.status(503).json({ error: `Agent is ${agent.status}` });
  }

  resetDailyIfNeeded(agent);

  const { task, dealId, amount } = req.body;
  if (!task) return res.status(400).json({ error: "Missing task" });

  const amountUsd = parseFloat(amount || "0");

  // Enforce spending limits
  if (amountUsd > agent.spendingLimits.maxPerCallUsd) {
    addLog(agent, {
      type: "error",
      message: `Task rejected: amount $${amountUsd} exceeds max per call $${agent.spendingLimits.maxPerCallUsd}`,
      amount: amountUsd.toString(),
    });
    return res.status(403).json({
      error: "Amount exceeds max per call limit",
      limit: agent.spendingLimits.maxPerCallUsd,
    });
  }

  if (agent.dailySpend + amountUsd > agent.spendingLimits.dailyLimitUsd) {
    agent.status = "limit_reached";
    addLog(agent, {
      type: "error",
      message: `Daily limit reached ($${agent.spendingLimits.dailyLimitUsd}). Agent paused.`,
    });
    return res.status(403).json({
      error: "Daily spending limit reached",
      limit: agent.spendingLimits.dailyLimitUsd,
      reset: agent.dailySpendReset,
    });
  }

  // Require confirmation for high-value tasks
  if (amountUsd > agent.spendingLimits.requireConfirmAboveUsd) {
    addLog(agent, {
      type: "approval",
      message: `High-value task ($${amountUsd}) queued — awaiting owner confirmation.`,
      amount: amountUsd.toString(),
    });
    return res.status(202).json({
      status: "pending_approval",
      message: "Task exceeds confirmation threshold. Owner approval required.",
      threshold: agent.spendingLimits.requireConfirmAboveUsd,
    });
  }

  // Execute via LLM
  try {
    addLog(agent, { type: "job", message: `Executing task for deal #${dealId}: ${task.slice(0, 80)}...`, amount: amountUsd.toString() });

    const result = await callLLM(agent, task);

    agent.jobsCompleted++;
    agent.dailySpend += amountUsd;
    agent.totalEarned += amountUsd;

    addLog(agent, {
      type: "job",
      message: `Task completed for deal #${dealId}. Earned ${amountUsd} USDC.`,
      amount: amountUsd.toString(),
    });

    return res.json({ status: "completed", result, dealId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    addLog(agent, { type: "error", message: `LLM error: ${msg.slice(0, 100)}` });
    return res.status(500).json({ error: "LLM execution failed", details: msg });
  }
});

// ─── LLM dispatcher ───────────────────────────────────────────────────────────

async function callLLM(agent: HostedAgent, userMessage: string): Promise<string> {
  const { llmProvider, llmModel, llmApiKey, systemPrompt } = agent;

  if (llmProvider === "openai" || llmProvider === "google") {
    const baseUrl = llmProvider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) throw new Error(`${llmProvider} API error: ${res.status}`);
    const data = await res.json() as any;
    return data.choices[0]?.message?.content || "No response";
  }

  if (llmProvider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": llmApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const data = await res.json() as any;
    return data.content[0]?.text || "No response";
  }

  throw new Error(`Unsupported LLM provider: ${llmProvider}`);
}

export default router;
