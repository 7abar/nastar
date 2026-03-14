/**
 * Chain Watcher
 * =============
 * Polls NastarEscrow for new DealCreated events where sellerAgentId
 * matches our agent. When found, triggers the job executor.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoSepolia, CONTRACTS_SEPOLIA, ESCROW_ABI, DEAL_STATUS } from "../lib/constants.js";
import type { OnchainDeal } from "../lib/offeringTypes.js";

type JobCallback = (deal: OnchainDeal) => Promise<void>;

const POLL_INTERVAL_MS = 15_000; // poll every 15s

export class DealWatcher {
  private pubClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient>;
  private account: ReturnType<typeof privateKeyToAccount>;
  private sellerAgentId: bigint;
  private onNewDeal: JobCallback;
  private lastCheckedBlock: bigint = 0n;
  private running = false;

  constructor(opts: {
    privateKey: `0x${string}`;
    sellerAgentId: bigint;
    onNewDeal: JobCallback;
  }) {
    this.account = privateKeyToAccount(opts.privateKey);
    this.sellerAgentId = opts.sellerAgentId;
    this.onNewDeal = opts.onNewDeal;

    this.pubClient = createPublicClient({
      chain: celoSepolia,
      transport: http(),
    });
    this.walletClient = createWalletClient({
      account: this.account,
      chain: celoSepolia,
      transport: http(),
    });

    console.log(`[watcher] Agent wallet: ${this.account.address}`);
    console.log(`[watcher] Watching for deals targeting agent ID: ${this.sellerAgentId}`);
  }

  async start() {
    this.running = true;
    this.lastCheckedBlock = (await this.pubClient.getBlockNumber()) - 100n;
    console.log(`[watcher] Starting from block ${this.lastCheckedBlock}`);

    while (this.running) {
      try {
        await this.poll();
      } catch (err) {
        console.error("[watcher] Poll error:", (err as Error).message);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  stop() {
    this.running = false;
    console.log("[watcher] Stopped.");
  }

  private async poll() {
    const currentBlock = await this.pubClient.getBlockNumber();
    if (currentBlock <= this.lastCheckedBlock) return;

    const logs = await this.pubClient.getLogs({
      address: CONTRACTS_SEPOLIA.NASTAR_ESCROW,
      event: parseAbiItem(
        "event DealCreated(uint256 indexed dealId, uint256 indexed buyerAgentId, uint256 indexed sellerAgentId, uint256 serviceId, address paymentToken, uint256 amount, uint256 deadline)"
      ),
      args: { sellerAgentId: this.sellerAgentId },
      fromBlock: this.lastCheckedBlock + 1n,
      toBlock: currentBlock,
    });

    if (logs.length > 0) {
      console.log(`[watcher] Found ${logs.length} new deal(s) in blocks ${this.lastCheckedBlock + 1n}–${currentBlock}`);
    }

    for (const log of logs) {
      const dealId = log.args.dealId!;
      console.log(`[watcher] New deal: ID=${dealId}`);

      try {
        const deal = await this.pubClient.readContract({
          address: CONTRACTS_SEPOLIA.NASTAR_ESCROW,
          abi: ESCROW_ABI,
          functionName: "getDeal",
          args: [dealId],
        });

        // Only process deals in Created status
        if (deal.status !== 0) {
          console.log(`[watcher] Deal ${dealId} already processed (status: ${DEAL_STATUS[deal.status]})`);
          continue;
        }

        await this.onNewDeal(deal as unknown as OnchainDeal);
      } catch (err) {
        console.error(`[watcher] Error processing deal ${dealId}:`, (err as Error).message);
      }
    }

    this.lastCheckedBlock = currentBlock;
  }

  /** Accept a deal on-chain */
  async acceptDeal(dealId: bigint): Promise<`0x${string}`> {
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS_SEPOLIA.NASTAR_ESCROW,
      abi: ESCROW_ABI,
      functionName: "acceptDeal",
      args: [dealId],
      account: this.account,
    });
    await this.pubClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  /** Deliver a deal on-chain with proof */
  async deliverDeal(dealId: bigint, proof: string): Promise<`0x${string}`> {
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS_SEPOLIA.NASTAR_ESCROW,
      abi: ESCROW_ABI,
      functionName: "deliverDeal",
      args: [dealId, proof],
      account: this.account,
    });
    await this.pubClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
