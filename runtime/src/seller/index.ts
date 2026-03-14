/**
 * Nastar Seller Runtime
 * =====================
 * Entry point. Loads offerings, starts the chain watcher,
 * and processes incoming deals automatically.
 *
 * Usage:
 *   PRIVATE_KEY=0x... SELLER_AGENT_ID=40 npx tsx src/seller/index.ts
 */

import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { DealWatcher } from "./watcher.js";
import { JobExecutor } from "./executor.js";

const BOLD  = "\x1b[1m";
const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

async function main() {
  console.log(`\n${BOLD}${CYAN}┌─────────────────────────────────────────┐`);
  console.log(`│   NASTAR SELLER RUNTIME                 │`);
  console.log(`│   on-chain agent commerce · Celo        │`);
  console.log(`└─────────────────────────────────────────┘${RESET}\n`);

  // ── Config ─────────────────────────────────────────────────────────────────
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const sellerAgentIdRaw = process.env.SELLER_AGENT_ID;

  if (!privateKey) {
    console.error("Error: PRIVATE_KEY env var required");
    process.exit(1);
  }
  if (!sellerAgentIdRaw) {
    console.error("Error: SELLER_AGENT_ID env var required (your ERC-8004 NFT token ID)");
    process.exit(1);
  }

  const sellerAgentId = BigInt(sellerAgentIdRaw);

  // Resolve offerings directory
  const offeringsDir = process.env.OFFERINGS_DIR
    ?? path.resolve(process.cwd(), "src/seller/offerings");

  // ── Init ───────────────────────────────────────────────────────────────────
  const watcher = new DealWatcher({
    privateKey,
    sellerAgentId,
    onNewDeal: async (deal) => {
      await executor.handleDeal(deal);
    },
  });

  const executor = new JobExecutor(watcher, offeringsDir);
  const offeringCount = await executor.loadOfferings();

  if (offeringCount === 0) {
    console.warn("Warning: No offerings loaded. Run `nastar sell init <name>` to create one.");
  } else {
    console.log(`\n${GREEN}✓${RESET} ${offeringCount} offering(s) loaded`);
    console.log(`${GREEN}✓${RESET} Seller agent ID: ${sellerAgentId}`);
    console.log(`${GREEN}✓${RESET} Runtime ready — watching for deals...\n`);
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  process.on("SIGINT", () => {
    console.log("\n[runtime] Shutting down...");
    watcher.stop();
    process.exit(0);
  });

  // ── Start watching ─────────────────────────────────────────────────────────
  await watcher.start();
}

main().catch((err) => {
  console.error("Runtime error:", err.message ?? err);
  process.exit(1);
});
