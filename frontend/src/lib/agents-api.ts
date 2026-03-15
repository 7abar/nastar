// Agent management — persisted in Supabase with localStorage fallback
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { supabase } from "./supabase";

export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  ownerAddress: string;
  agentWallet: string;
  agentPrivateKey: string;
  apiKey: string;
  apiKeyActive: boolean;
  agentNftId: number | null;
  serviceId: number | null;
  endpoint: string;
  tags: string[];
  pricePerCall: string;
  paymentToken: string;
  avatar: string | null;
  createdAt: number;
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "nst_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export function generateAgentWallet(): { address: string; privateKey: string } {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { address: account.address, privateKey: pk };
}

// ─── Supabase persistence ────────────────────────────────────────────────────

function toRow(agent: RegisteredAgent) {
  return {
    id: agent.id,
    owner_address: agent.ownerAddress,
    agent_wallet: agent.agentWallet,
    agent_private_key: agent.agentPrivateKey,
    api_key: agent.apiKey,
    api_key_active: agent.apiKeyActive,
    name: agent.name,
    description: agent.description,
    agent_nft_id: agent.agentNftId,
    service_id: agent.serviceId,
    endpoint: agent.endpoint,
    tags: agent.tags,
    price_per_call: agent.pricePerCall,
    payment_token: agent.paymentToken,
    avatar: agent.avatar,
    created_at: agent.createdAt,
  };
}

function fromRow(row: any): RegisteredAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerAddress: row.owner_address,
    agentWallet: row.agent_wallet,
    agentPrivateKey: row.agent_private_key,
    apiKey: row.api_key,
    apiKeyActive: row.api_key_active,
    agentNftId: row.agent_nft_id,
    serviceId: row.service_id,
    endpoint: row.endpoint,
    tags: row.tags || [],
    pricePerCall: row.price_per_call,
    paymentToken: row.payment_token,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

// ─── LocalStorage fallback (offline / SSR) ──────────────────────────────────

const STORAGE_KEY = "nastar_agents";

function getLocalAgents(): RegisteredAgent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveLocalAgents(agents: RegisteredAgent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function storeAgent(agent: RegisteredAgent): Promise<void> {
  // Always save locally first (instant)
  const local = getLocalAgents();
  local.push(agent);
  saveLocalAgents(local);

  // Persist to Supabase
  try {
    await supabase.from("registered_agents").upsert(toRow(agent), { onConflict: "id" });
  } catch (err) {
    console.warn("Supabase persist failed, using localStorage only:", err);
  }
}

export async function getStoredAgentsByOwner(ownerAddress: string): Promise<RegisteredAgent[]> {
  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from("registered_agents")
      .select("*")
      .eq("owner_address", ownerAddress.toLowerCase())
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) return data.map(fromRow);
  } catch { /* fall through */ }

  // Fallback to localStorage
  return getLocalAgents().filter(a => a.ownerAddress.toLowerCase() === ownerAddress.toLowerCase());
}

export function getStoredAgents(): RegisteredAgent[] {
  return getLocalAgents();
}

export async function updateAgent(id: string, updates: Partial<RegisteredAgent>): Promise<void> {
  // Update locally
  const agents = getLocalAgents();
  const idx = agents.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...updates };
    saveLocalAgents(agents);
  }
  // Update in Supabase
  try {
    const rowUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) rowUpdates.name = updates.name;
    if (updates.description !== undefined) rowUpdates.description = updates.description;
    if (updates.apiKeyActive !== undefined) rowUpdates.api_key_active = updates.apiKeyActive;
    if (updates.agentNftId !== undefined) rowUpdates.agent_nft_id = updates.agentNftId;
    if (updates.serviceId !== undefined) rowUpdates.service_id = updates.serviceId;
    await supabase.from("registered_agents").update(rowUpdates).eq("id", id);
  } catch { /* silent */ }
}

export function getAgentByApiKey(apiKey: string): RegisteredAgent | null {
  return getLocalAgents().find((a) => a.apiKey === apiKey && a.apiKeyActive) || null;
}
