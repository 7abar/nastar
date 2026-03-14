#!/usr/bin/env tsx
/**
 * Nastar CLI
 * ==========
 * nastar sell init <name>    Scaffold a new offering
 * nastar sell list           List registered offerings
 * nastar serve start         Start the seller runtime
 * nastar serve stop          Stop the seller runtime
 * nastar serve status        Show runtime status
 * nastar serve logs          Tail runtime logs
 */

import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";

const BOLD   = "\x1b[1m";
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM    = "\x1b[2m";
const RED    = "\x1b[31m";
const RESET  = "\x1b[0m";

const OFFERINGS_DIR = path.resolve(process.cwd(), "src/seller/offerings");
const PID_FILE      = path.resolve(process.cwd(), ".nastar-runtime.pid");
const LOG_FILE      = path.resolve(process.cwd(), ".nastar-runtime.log");

const args = process.argv.slice(2);
const [cmd, sub, name] = args;

function banner() {
  console.log(`\n${BOLD}${CYAN}NASTAR${RESET} — Agent Marketplace CLI · Celo\n`);
}

function ok(msg: string)   { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function warn(msg: string)  { console.log(`  ${YELLOW}!${RESET} ${msg}`); }
function err(msg: string)   { console.log(`  ${RED}✗${RESET} ${msg}`); }
function info(msg: string)  { console.log(`  ${DIM}${msg}${RESET}`); }

// ── nastar sell init <name> ───────────────────────────────────────────────────
function sellInit(offeringName: string) {
  if (!offeringName) {
    err("Usage: nastar sell init <offering-name>");
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(offeringName)) {
    err("Name must start with a lowercase letter and contain only [a-z0-9_]");
    process.exit(1);
  }

  const dir = path.join(OFFERINGS_DIR, offeringName);
  if (fs.existsSync(dir)) {
    err(`Offering '${offeringName}' already exists at ${dir}`);
    process.exit(1);
  }

  fs.mkdirSync(dir, { recursive: true });

  // offering.json template
  const config = {
    name: offeringName,
    description: "",
    endpoint: `https://your-agent.example.com/${offeringName}`,
    pricePerCall: "500000000000000000",
    paymentToken: "0x0000000000000000000000000000000000000000",
    tags: [],
  };
  fs.writeFileSync(path.join(dir, "offering.json"), JSON.stringify(config, null, 2));

  // handlers.ts template
  const handlersTemplate = `import type { ExecuteJobResult, ValidationResult, OnchainDeal } from "../../../lib/offeringTypes.js";

/**
 * REQUIRED — Execute the job and return a deliverable.
 * The deliverable is stored on-chain as proof of work.
 *
 * @param taskDescription  The buyer's task (from Deal.taskDescription)
 * @param deal             Full deal struct from the chain
 */
export async function executeJob(
  taskDescription: string,
  deal: OnchainDeal
): Promise<ExecuteJobResult> {
  // TODO: implement your service logic here
  // Examples:
  //   - Fetch data from an API and return JSON
  //   - Run a computation and return the result
  //   - Call an on-chain contract and return the tx hash
  //   - Anything else that produces a result worth paying for

  const result = {
    task: taskDescription,
    executedBy: deal.seller,
    timestamp: new Date().toISOString(),
    output: "TODO: replace with real output",
  };

  return { deliverable: JSON.stringify(result) };
}

/**
 * OPTIONAL — Validate the task before accepting.
 * Return { valid: false, reason } to reject automatically.
 */
export function validateTask(
  taskDescription: string,
  deal: OnchainDeal
): ValidationResult {
  if (!taskDescription || taskDescription.length < 5) {
    return { valid: false, reason: "Task description too short (min 5 chars)" };
  }
  return { valid: true };
}
`;
  fs.writeFileSync(path.join(dir, "handlers.ts"), handlersTemplate);

  console.log();
  ok(`Offering scaffolded: ${offeringName}`);
  info(`Directory: ${dir}`);
  console.log(`\n  ${BOLD}Next steps:${RESET}`);
  console.log(`  1. Edit ${CYAN}${path.join(dir, "offering.json")}${RESET}`);
  console.log(`     Set description, pricePerCall, paymentToken, tags`);
  console.log(`  2. Edit ${CYAN}${path.join(dir, "handlers.ts")}${RESET}`);
  console.log(`     Implement executeJob() — this is where your service logic lives`);
  console.log(`  3. Start the runtime:`);
  console.log(`     ${DIM}PRIVATE_KEY=0x... SELLER_AGENT_ID=<your-nft-id> nastar serve start${RESET}\n`);
}

// ── nastar sell list ──────────────────────────────────────────────────────────
function sellList() {
  if (!fs.existsSync(OFFERINGS_DIR)) {
    warn("No offerings directory found. Run: nastar sell init <name>");
    return;
  }

  const entries = fs.readdirSync(OFFERINGS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory());

  if (entries.length === 0) {
    warn("No offerings found. Run: nastar sell init <name>");
    return;
  }

  console.log(`\n  ${BOLD}Offerings (${entries.length})${RESET}\n`);
  for (const entry of entries) {
    const configPath = path.join(OFFERINGS_DIR, entry.name, "offering.json");
    const handlersPath = path.join(OFFERINGS_DIR, entry.name, "handlers.ts");

    let config: Record<string, unknown> = {};
    try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch {}

    const hasHandlers = fs.existsSync(handlersPath);
    const ready = config.description && config.pricePerCall && hasHandlers;

    console.log(`  ${ready ? GREEN + "●" : YELLOW + "○"}${RESET} ${BOLD}${entry.name}${RESET}`);
    if (config.description) info(`  ${config.description}`);
    if (config.pricePerCall) info(`  Price: ${config.pricePerCall} (base units)`);
    if (!hasHandlers) warn("  Missing handlers.ts");
  }
  console.log();
}

// ── nastar serve start ────────────────────────────────────────────────────────
function serveStart() {
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, "utf8").trim();
    try {
      process.kill(Number(pid), 0);
      warn(`Runtime already running (PID ${pid})`);
      return;
    } catch {}
  }

  const privateKey = process.env.PRIVATE_KEY;
  const sellerAgentId = process.env.SELLER_AGENT_ID;

  if (!privateKey || !sellerAgentId) {
    err("PRIVATE_KEY and SELLER_AGENT_ID env vars required");
    info("Example: PRIVATE_KEY=0x... SELLER_AGENT_ID=40 nastar serve start");
    process.exit(1);
  }

  const runtimeEntry = path.resolve(process.cwd(), "src/seller/index.ts");
  const logStream = fs.openSync(LOG_FILE, "a");

  const child = spawn("npx", ["tsx", runtimeEntry], {
    detached: true,
    stdio: ["ignore", logStream, logStream],
    env: { ...process.env },
  });
  child.unref();

  fs.writeFileSync(PID_FILE, String(child.pid));
  ok(`Runtime started (PID ${child.pid})`);
  info(`Logs: ${LOG_FILE}`);
  info(`Watching for deals targeting agent ID: ${sellerAgentId}`);
  console.log(`\n  ${DIM}nastar serve logs    — view logs`);
  console.log(`  nastar serve stop    — stop runtime${RESET}\n`);
}

// ── nastar serve stop ─────────────────────────────────────────────────────────
function serveStop() {
  if (!fs.existsSync(PID_FILE)) {
    warn("Runtime not running");
    return;
  }
  const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
  try {
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(PID_FILE);
    ok(`Runtime stopped (PID ${pid})`);
  } catch {
    err(`Could not stop PID ${pid} — may already be stopped`);
    fs.unlinkSync(PID_FILE);
  }
}

// ── nastar serve status ───────────────────────────────────────────────────────
function serveStatus() {
  if (!fs.existsSync(PID_FILE)) {
    warn("Runtime: stopped");
    return;
  }
  const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
  try {
    process.kill(pid, 0);
    ok(`Runtime: running (PID ${pid})`);
    info(`Logs: ${LOG_FILE}`);
  } catch {
    warn("Runtime: stopped (stale PID file)");
    fs.unlinkSync(PID_FILE);
  }
}

// ── nastar serve logs ─────────────────────────────────────────────────────────
function serveLogs(follow = false) {
  if (!fs.existsSync(LOG_FILE)) {
    warn("No log file found. Start the runtime first.");
    return;
  }
  if (follow) {
    const tail = spawn("tail", ["-f", LOG_FILE], { stdio: "inherit" });
    tail.on("close", () => process.exit(0));
    process.on("SIGINT", () => { tail.kill(); process.exit(0); });
  } else {
    const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").slice(-50);
    console.log(lines.join("\n"));
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
banner();

if (cmd === "sell") {
  if (sub === "init")  sellInit(name);
  else if (sub === "list") sellList();
  else { err(`Unknown subcommand: sell ${sub}`); }
} else if (cmd === "serve") {
  if (sub === "start")       serveStart();
  else if (sub === "stop")   serveStop();
  else if (sub === "status") serveStatus();
  else if (sub === "logs")   serveLogs(args.includes("--follow"));
  else { err(`Unknown subcommand: serve ${sub}`); }
} else {
  console.log(`  ${BOLD}Commands:${RESET}\n`);
  console.log(`  ${CYAN}sell init <name>${RESET}    Scaffold a new offering`);
  console.log(`  ${CYAN}sell list${RESET}           List all offerings`);
  console.log(`  ${CYAN}serve start${RESET}         Start the seller runtime`);
  console.log(`  ${CYAN}serve stop${RESET}          Stop the seller runtime`);
  console.log(`  ${CYAN}serve status${RESET}        Show runtime status`);
  console.log(`  ${CYAN}serve logs${RESET}          View recent logs`);
  console.log(`  ${CYAN}serve logs --follow${RESET} Tail logs in real time`);
  console.log(`\n  ${DIM}Env vars: PRIVATE_KEY, SELLER_AGENT_ID, OFFERINGS_DIR${RESET}\n`);
}
