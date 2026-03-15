import { defineChain } from "viem";

export const celoSepolia = defineChain({
  id: 44787,
  name: "Celo Alfajores",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://alfajores-forno.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celo Explorer", url: "https://alfajores.celoscan.io" },
  },
  testnet: true,
});

// Use Celo Sepolia (chain 11142220) for our contracts
export const celoSepoliaCustom = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celo Explorer", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

export const CONTRACTS = {
  SERVICE_REGISTRY: "0x8117e9bea366df4737f5acb09b03a1885e433c79" as `0x${string}`,
  NASTAR_ESCROW: "0x9ea23a3b8579cffff9a9a2921ba93b3562bb4a2c" as `0x${string}`,
  IDENTITY_REGISTRY: "0xa142c78a0a04de296cc463362d251e782cf8583e" as `0x${string}`,
  MOCK_USDC: "0x93C86be298bcF530E183954766f103B061BF64Ef" as `0x${string}`,
} as const;

// ── Mento Stablecoins — Celo Sepolia Testnet ─────────────────────────────────
// Source: https://docs.celo.org/tooling/contracts/token-contracts
export const CELO_TOKENS = {
  USDm:  "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as `0x${string}`,  // ✓ Celo Sepolia verified
  EURm:  "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a" as `0x${string}`,
  BRLm:  "0x2294298942fdc79417DE9E0D740A4957E0e7783a" as `0x${string}`,
  COPm: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67" as `0x${string}`,
  XOFm: "0x5505b70207aE3B826c1A7607F19F3Bf73444A082" as `0x${string}`,
  KESm:  "0xC7e4635651E3e3Af82b61d3E23c159438daE3BbF" as `0x${string}`,
  PHPm:  "0x0352976d940a2C3FBa0C3623198947Ee1d17869E" as `0x${string}`,
  GBPm:  "0x85F5181Abdbf0e1814Fc4358582Ae07b8eBA3aF3" as `0x${string}`,
  NGNm:  "0x3d5ae86F34E2a82771496D140daFAEf3789dF888" as `0x${string}`,
  GHSm:  "0x5e94B8C872bD47BC4255E60ECBF44D5E66e7401C" as `0x${string}`,
  ZARm:  "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e" as `0x${string}`,
  CADm:  "0xF151c9a13b78C84f93f50B8b3bC689fedc134F60" as `0x${string}`,
  AUDm:  "0x5873Faeb42F3563dcD77F0fbbdA818E6d6DA3139" as `0x${string}`,
  JPYm:  "0x85Bee67D435A39f7467a8a9DE34a5B73D25Df426" as `0x${string}`,
  CHFm:  "0x284E9b7B623eAE866914b7FA0eB720C2Bb3C2980" as `0x${string}`,
  USDC: "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as `0x${string}`,
} as const;

export interface TokenMeta {
  symbol: string;
  name: string;
  flag: string;
  address: `0x${string}`;
  decimals: number;
}

export const TOKEN_LIST: TokenMeta[] = [
  // USD-pegged
  { symbol: "USDm", name: "Mento Dollar",              flag: "🇺🇸", address: CELO_TOKENS.USDm, decimals: 18 },
  { symbol: "USDC", name: "USD Coin",                  flag: "💵", address: CELO_TOKENS.USDC, decimals: 6  },
  // Major currencies
  { symbol: "EURm", name: "Mento Euro",                flag: "🇪🇺", address: CELO_TOKENS.EURm, decimals: 18 },
  { symbol: "GBPm", name: "Mento British Pound",       flag: "🇬🇧", address: CELO_TOKENS.GBPm, decimals: 18 },
  { symbol: "CHFm", name: "Mento Swiss Franc",         flag: "🇨🇭", address: CELO_TOKENS.CHFm, decimals: 18 },
  { symbol: "CADm", name: "Mento Canadian Dollar",     flag: "🇨🇦", address: CELO_TOKENS.CADm, decimals: 18 },
  { symbol: "AUDm", name: "Mento Australian Dollar",   flag: "🇦🇺", address: CELO_TOKENS.AUDm, decimals: 18 },
  { symbol: "JPYm", name: "Mento Japanese Yen",        flag: "🇯🇵", address: CELO_TOKENS.JPYm, decimals: 18 },
  // Latin America
  { symbol: "BRLm", name: "Mento Brazilian Real",      flag: "🇧🇷", address: CELO_TOKENS.BRLm, decimals: 18 },
  { symbol: "COPm", name: "Mento Colombian Peso",      flag: "🇨🇴", address: CELO_TOKENS.COPm, decimals: 18 },
  // Africa
  { symbol: "KESm", name: "Mento Kenyan Shilling",     flag: "🇰🇪", address: CELO_TOKENS.KESm, decimals: 18 },
  { symbol: "NGNm", name: "Mento Nigerian Naira",      flag: "🇳🇬", address: CELO_TOKENS.NGNm, decimals: 18 },
  { symbol: "GHSm", name: "Mento Ghanaian Cedi",       flag: "🇬🇭", address: CELO_TOKENS.GHSm, decimals: 18 },
  { symbol: "ZARm", name: "Mento South African Rand",  flag: "🇿🇦", address: CELO_TOKENS.ZARm, decimals: 18 },
  { symbol: "XOFm", name: "Mento West African CFA",    flag: "🌍", address: CELO_TOKENS.XOFm, decimals: 18 },
  // Asia-Pacific
  { symbol: "PHPm", name: "Mento Philippine Peso",     flag: "🇵🇭", address: CELO_TOKENS.PHPm, decimals: 18 },
];

export function getTokenByAddress(address: string): TokenMeta | undefined {
  return TOKEN_LIST.find(t => t.address.toLowerCase() === address.toLowerCase());
}

export function formatTokenAmount(amount: bigint | string, token: TokenMeta): string {
  const raw = typeof amount === "string" ? BigInt(amount) : amount;
  const value = Number(raw) / 10 ** token.decimals;
  return `${token.flag} ${value.toFixed(2)} ${token.symbol}`;
}

export const DEAL_STATUS: Record<number, string> = {
  0: "Created",
  1: "Accepted",
  2: "Delivered",
  3: "Completed",
  4: "Disputed",
  5: "Refunded",
  6: "Expired",
  7: "Resolved",
};

export const DEAL_STATUS_COLOR: Record<number, string> = {
  0: "bg-blue-500/20 text-blue-400",
  1: "bg-yellow-500/20 text-yellow-400",
  2: "bg-purple-500/20 text-purple-400",
  3: "bg-green-500/20 text-green-400",
  4: "bg-red-500/20 text-red-400",
  5: "bg-orange-500/20 text-orange-400",
  6: "bg-gray-500/20 text-gray-400",
  7: "bg-teal-500/20 text-teal-400",
};

export const SERVICE_REGISTRY_ABI = [
  {
    type: "function", name: "registerService",
    inputs: [
      { name: "agentId", type: "uint256" }, { name: "name", type: "string" },
      { name: "description", type: "string" }, { name: "endpoint", type: "string" },
      { name: "paymentToken", type: "address" }, { name: "pricePerCall", type: "uint256" },
      { name: "tags", type: "string[]" },
    ],
    outputs: [{ name: "serviceId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getActiveServices",
    inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [
      {
        name: "result", type: "tuple[]",
        components: [
          { name: "agentId", type: "uint256" }, { name: "provider", type: "address" },
          { name: "name", type: "string" }, { name: "description", type: "string" },
          { name: "endpoint", type: "string" }, { name: "paymentToken", type: "address" },
          { name: "pricePerCall", type: "uint256" }, { name: "active", type: "bool" },
          { name: "createdAt", type: "uint256" }, { name: "updatedAt", type: "uint256" },
        ],
      },
      { name: "count", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "getService",
    inputs: [{ name: "serviceId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "agentId", type: "uint256" }, { name: "provider", type: "address" },
        { name: "name", type: "string" }, { name: "description", type: "string" },
        { name: "endpoint", type: "string" }, { name: "paymentToken", type: "address" },
        { name: "pricePerCall", type: "uint256" }, { name: "active", type: "bool" },
        { name: "createdAt", type: "uint256" }, { name: "updatedAt", type: "uint256" },
      ],
    }],
    stateMutability: "view",
  },
] as const;

export const ESCROW_ABI = [
  {
    type: "function", name: "createDeal",
    inputs: [
      { name: "serviceId", type: "uint256" }, { name: "buyerAgentId", type: "uint256" },
      { name: "sellerAgentId", type: "uint256" }, { name: "paymentToken", type: "address" },
      { name: "amount", type: "uint256" }, { name: "taskDescription", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "autoConfirm", type: "bool" },
    ],
    outputs: [{ name: "dealId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "confirmDelivery",
    inputs: [{ name: "dealId", type: "uint256" }], outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "disputeDeal",
    inputs: [{ name: "dealId", type: "uint256" }], outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "claimRefund",
    inputs: [{ name: "dealId", type: "uint256" }], outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getDeal",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "dealId", type: "uint256" }, { name: "serviceId", type: "uint256" },
        { name: "buyerAgentId", type: "uint256" }, { name: "sellerAgentId", type: "uint256" },
        { name: "buyer", type: "address" }, { name: "seller", type: "address" },
        { name: "paymentToken", type: "address" }, { name: "amount", type: "uint256" },
        { name: "taskDescription", type: "string" }, { name: "deliveryProof", type: "string" },
        { name: "status", type: "uint8" }, { name: "createdAt", type: "uint256" },
        { name: "deadline", type: "uint256" }, { name: "completedAt", type: "uint256" },
        { name: "disputedAt", type: "uint256" },
      ],
    }],
    stateMutability: "view",
  },
  {
    type: "function", name: "getBuyerDeals",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function", name: "nextDealId",
    inputs: [], outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event", name: "DisputeResolved",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "sellerBps", type: "uint256", indexed: false },
      { name: "buyerAmount", type: "uint256", indexed: false },
      { name: "sellerAmount", type: "uint256", indexed: false },
      { name: "feeAmount", type: "uint256", indexed: false },
      { name: "reasoning", type: "string", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function", name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
] as const;

export const ERC8004_ABI = [
  {
    type: "function", name: "register",
    inputs: [], outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "setAgentURI",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "uri", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "agentURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }], stateMutability: "view",
  },
] as const;

// ERC-8004 Reputation Registry (Celo Sepolia)
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`;
export const REPUTATION_ABI = [
  {
    type: "function", name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "uint8" },
      { name: "tag", type: "string" },
      { name: "comment", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function", name: "getSummary",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "totalFeedback", type: "uint256" },
      { name: "averageScore", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;
