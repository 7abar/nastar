/**
 * Nastar Offering Types
 * ====================
 * Same pattern as ACP (Virtuals Protocol) — sellers define their
 * service in offering.json and implement handlers in handlers.ts.
 * The runtime handles deal watching, accepting, executing, and delivering.
 */

export interface OfferingConfig {
  /** Unique slug: lowercase letters, numbers, underscores only */
  name: string;
  /** Human-readable description shown in ServiceRegistry */
  description: string;
  /** API endpoint registered on-chain (can be a URL or contact URI) */
  endpoint: string;
  /** Price per call in the payment token's base units (e.g. 1e18 = 1 token with 18 decimals) */
  pricePerCall: string;
  /** ERC-20 token address accepted as payment. Use address(0) for any. */
  paymentToken: string;
  /** Category tags for discovery (e.g. ["data", "celo", "price-feed"]) */
  tags?: string[];
}

export interface ExecuteJobResult {
  /** The deliverable returned to the buyer — stored on-chain as proof */
  deliverable: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Handler interface — implement these in handlers.ts.
 * Only executeJob is required. Others are optional.
 */
export interface OfferingHandlers {
  /**
   * REQUIRED. Execute the job and return a deliverable.
   * Called after the deal is accepted. The deliverable is posted
   * on-chain via deliverDeal() and becomes permanent proof of work.
   *
   * @param taskDescription  The buyer's task description (from Deal.taskDescription)
   * @param deal             Full deal object from the chain
   */
  executeJob(taskDescription: string, deal: OnchainDeal): Promise<ExecuteJobResult>;

  /**
   * OPTIONAL. Validate the task before accepting.
   * Return { valid: false, reason } to reject a deal automatically.
   */
  validateTask?(taskDescription: string, deal: OnchainDeal): ValidationResult;
}

export interface OnchainDeal {
  dealId: bigint;
  serviceId: bigint;
  buyerAgentId: bigint;
  sellerAgentId: bigint;
  buyer: `0x${string}`;
  seller: `0x${string}`;
  paymentToken: `0x${string}`;
  amount: bigint;
  taskDescription: string;
  deliveryProof: string;
  status: number;
  createdAt: bigint;
  deadline: bigint;
  completedAt: bigint;
  disputedAt: bigint;
}
