/**
 * Job Executor
 * ============
 * Loads offerings from disk, validates incoming deals, executes handlers,
 * and delivers results on-chain.
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import type { OfferingConfig, OfferingHandlers, OnchainDeal } from "../lib/offeringTypes.js";
import { DealWatcher } from "./watcher.js";

export interface LoadedOffering {
  config: OfferingConfig;
  handlers: OfferingHandlers;
  dir: string;
}

export class JobExecutor {
  private offerings: Map<string, LoadedOffering> = new Map();
  private watcher: DealWatcher;
  private offeringsDir: string;

  constructor(watcher: DealWatcher, offeringsDir: string) {
    this.watcher = watcher;
    this.offeringsDir = offeringsDir;
  }

  /** Scan offerings directory and load all valid offerings */
  async loadOfferings(): Promise<number> {
    if (!fs.existsSync(this.offeringsDir)) {
      console.warn(`[executor] Offerings dir not found: ${this.offeringsDir}`);
      return 0;
    }

    const entries = fs.readdirSync(this.offeringsDir, { withFileTypes: true });
    let loaded = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.offeringsDir, entry.name);

      try {
        const offering = await this.loadOffering(dir);
        this.offerings.set(offering.config.name, offering);
        console.log(`[executor] Loaded offering: ${offering.config.name}`);
        loaded++;
      } catch (err) {
        console.warn(`[executor] Skip ${entry.name}: ${(err as Error).message}`);
      }
    }

    return loaded;
  }

  private async loadOffering(dir: string): Promise<LoadedOffering> {
    const configPath = path.join(dir, "offering.json");
    const handlersPath = path.join(dir, "handlers.ts");

    if (!fs.existsSync(configPath)) throw new Error("missing offering.json");
    if (!fs.existsSync(handlersPath)) throw new Error("missing handlers.ts");

    const config: OfferingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config.name) throw new Error("offering.json missing 'name'");
    if (!config.description) throw new Error("offering.json missing 'description'");
    if (!config.pricePerCall) throw new Error("offering.json missing 'pricePerCall'");

    // Dynamically import handlers
    const handlersUrl = pathToFileURL(handlersPath).href;
    const handlers: OfferingHandlers = await import(handlersUrl);
    if (typeof handlers.executeJob !== "function") {
      throw new Error("handlers.ts must export executeJob()");
    }

    return { config, handlers, dir };
  }

  /** Find which offering matches a serviceId (by position in registry) */
  findOffering(serviceId: bigint): LoadedOffering | undefined {
    // For simplicity, find offering by matching service name in config
    // In production: index serviceId → offering.name on registration
    return [...this.offerings.values()][0]; // MVP: first offering
  }

  /** Full deal lifecycle: validate → accept → execute → deliver */
  async handleDeal(deal: OnchainDeal): Promise<void> {
    const dealId = deal.dealId;
    console.log(`\n[executor] === Processing deal ${dealId} ===`);
    console.log(`[executor] Task: ${deal.taskDescription}`);
    console.log(`[executor] Amount: ${deal.amount} (token: ${deal.paymentToken})`);

    const offering = this.findOffering(deal.serviceId);
    if (!offering) {
      console.warn(`[executor] No offering found for serviceId=${deal.serviceId} — skipping`);
      return;
    }

    // Step 1: Validate (optional)
    if (offering.handlers.validateTask) {
      const validation = offering.handlers.validateTask(deal.taskDescription, deal);
      if (!validation.valid) {
        console.log(`[executor] Deal ${dealId} rejected: ${validation.reason}`);
        // Note: no on-chain rejection in MVP — deal expires naturally
        return;
      }
      console.log(`[executor] Validation passed`);
    }

    // Step 2: Accept on-chain
    console.log(`[executor] Accepting deal ${dealId}...`);
    const acceptTx = await this.watcher.acceptDeal(dealId);
    console.log(`[executor] Accepted: ${acceptTx}`);
    console.log(`  https://sepolia.celoscan.io/tx/${acceptTx}`);

    // Step 3: Execute handler
    console.log(`[executor] Executing handler: ${offering.config.name}...`);
    let result: { deliverable: string };
    try {
      result = await offering.handlers.executeJob(deal.taskDescription, deal);
    } catch (err) {
      const errorProof = JSON.stringify({
        error: (err as Error).message,
        dealId: dealId.toString(),
        timestamp: new Date().toISOString(),
      });
      console.error(`[executor] Handler threw — delivering error proof`);
      await this.watcher.deliverDeal(dealId, errorProof);
      return;
    }

    console.log(`[executor] Handler complete. Deliverable preview: ${result.deliverable.slice(0, 100)}...`);

    // Step 4: Deliver proof on-chain
    console.log(`[executor] Delivering proof on-chain...`);
    const deliverTx = await this.watcher.deliverDeal(dealId, result.deliverable);
    console.log(`[executor] Delivered: ${deliverTx}`);
    console.log(`  https://sepolia.celoscan.io/tx/${deliverTx}`);
    console.log(`[executor] === Deal ${dealId} complete ===\n`);
  }
}
