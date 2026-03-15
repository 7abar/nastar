import { defineChain } from "viem";

// ── Celo Alfajores (Nastar testnet) ──────────────────────────────────────────
export const celoAlfajores = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  network: "celo-sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
    public: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celo Sepolia Explorer", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

// ── Contract addresses ────────────────────────────────────────────────────────
export const CONTRACTS = {
  SERVICE_REGISTRY: "0x8117e9bea366df4737f5acb09b03a1885e433c79" as `0x${string}`,
  NASTAR_ESCROW: "0x9ea23a3b8579cffff9a9a2921ba93b3562bb4a2c" as `0x${string}`,
  IDENTITY_REGISTRY: "0xa142c78a0a04de296cc463362d251e782cf8583e" as `0x${string}`,
} as const;

// ── Mento Stablecoins — Celo Sepolia Testnet ─────────────────────────────────
// Verified from @mento-protocol/mento-sdk routes (ChainId.CELO_SEPOLIA)
// Run: Mento.create(11142220).then(m => m.routes.getRoutes()) to verify
export const TOKENS = {
  // USD-pegged
  USDm:  "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as `0x${string}`,
  USDC:  "0x01C5C0122039549AD1493B8220cABEdD739BC44E" as `0x${string}`,
  // Major currencies
  EURm:  "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a" as `0x${string}`,
  GBPm:  "0x85F5181Abdbf0e1814Fc4358582Ae07b8eBA3aF3" as `0x${string}`,
  CHFm:  "0x284E9b7B623eAE866914b7FA0eB720C2Bb3C2980" as `0x${string}`,
  CADm:  "0xF151c9a13b78C84f93f50B8b3bC689fedc134F60" as `0x${string}`,
  AUDm:  "0x5873Faeb42F3563dcD77F0fbbdA818E6d6DA3139" as `0x${string}`,
  JPYm:  "0x85Bee67D435A39f7467a8a9DE34a5B73D25Df426" as `0x${string}`,
  // Latin America
  BRLm:  "0x2294298942fdc79417DE9E0D740A4957E0e7783a" as `0x${string}`,
  COPm:  "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67" as `0x${string}`,
  // Africa
  KESm:  "0xC7e4635651E3e3Af82b61d3E23c159438daE3BbF" as `0x${string}`,
  NGNm:  "0x3d5ae86F34E2a82771496D140daFAEf3789dF888" as `0x${string}`,
  GHSm:  "0x5e94B8C872bD47BC4255E60ECBF44D5E66e7401C" as `0x${string}`,
  ZARm:  "0x10CCfB235b0E1Ed394bACE4560C3ed016697687e" as `0x${string}`,
  XOFm:  "0x5505b70207aE3B826c1A7607F19F3Bf73444A082" as `0x${string}`,
  // Asia-Pacific
  PHPm:  "0x0352976d940a2C3FBa0C3623198947Ee1d17869E" as `0x${string}`,
} as const;

// Alias
export const CELO_TOKENS = TOKENS;

// Human-readable token metadata
export const TOKEN_META: Record<string, { symbol: string; name: string; flag: string; decimals: number }> = {
  // USD-pegged
  [TOKENS.USDm.toLowerCase()]:  { symbol: "USDm",  name: "Mento Dollar",             flag: "🇺🇸", decimals: 18 },
  [TOKENS.USDC.toLowerCase()]:  { symbol: "USDC",  name: "USD Coin",                 flag: "💵", decimals: 6  },
  // Major currencies
  [TOKENS.EURm.toLowerCase()]:  { symbol: "EURm",  name: "Mento Euro",               flag: "🇪🇺", decimals: 18 },
  [TOKENS.GBPm.toLowerCase()]:  { symbol: "GBPm",  name: "Mento British Pound",      flag: "🇬🇧", decimals: 18 },
  [TOKENS.CHFm.toLowerCase()]:  { symbol: "CHFm",  name: "Mento Swiss Franc",        flag: "🇨🇭", decimals: 18 },
  [TOKENS.CADm.toLowerCase()]:  { symbol: "CADm",  name: "Mento Canadian Dollar",    flag: "🇨🇦", decimals: 18 },
  [TOKENS.AUDm.toLowerCase()]:  { symbol: "AUDm",  name: "Mento Australian Dollar",  flag: "🇦🇺", decimals: 18 },
  [TOKENS.JPYm.toLowerCase()]:  { symbol: "JPYm",  name: "Mento Japanese Yen",       flag: "🇯🇵", decimals: 18 },
  // Latin America
  [TOKENS.BRLm.toLowerCase()]:  { symbol: "BRLm",  name: "Mento Brazilian Real",     flag: "🇧🇷", decimals: 18 },
  [TOKENS.COPm.toLowerCase()]:  { symbol: "COPm",  name: "Mento Colombian Peso",     flag: "🇨🇴", decimals: 18 },
  // Africa
  [TOKENS.KESm.toLowerCase()]:  { symbol: "KESm",  name: "Mento Kenyan Shilling",    flag: "🇰🇪", decimals: 18 },
  [TOKENS.NGNm.toLowerCase()]:  { symbol: "NGNm",  name: "Mento Nigerian Naira",     flag: "🇳🇬", decimals: 18 },
  [TOKENS.GHSm.toLowerCase()]:  { symbol: "GHSm",  name: "Mento Ghanaian Cedi",      flag: "🇬🇭", decimals: 18 },
  [TOKENS.ZARm.toLowerCase()]:  { symbol: "ZARm",  name: "Mento South African Rand", flag: "🇿🇦", decimals: 18 },
  [TOKENS.XOFm.toLowerCase()]:  { symbol: "XOFm",  name: "Mento West African CFA",   flag: "🌍", decimals: 18 },
  // Asia-Pacific
  [TOKENS.PHPm.toLowerCase()]:  { symbol: "PHPm",  name: "Mento Philippine Peso",    flag: "🇵🇭", decimals: 18 },
};

export function getTokenMeta(address: string) {
  return TOKEN_META[address.toLowerCase()] ?? { symbol: "???", name: "Unknown Token", flag: "🪙", decimals: 18 };
}

// ── x402 payment config ───────────────────────────────────────────────────────
export const X402_CONFIG = {
  // Server wallet — receives micro-payments for premium endpoints
  payTo: (process.env.SERVER_WALLET ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  // Price per premium API call: 0.001 USDm (1000 units, 6 decimals)
  priceWei: BigInt(1000),
  token: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b" as `0x${string}`,
  network: "celo-sepolia",
};

export const PORT = Number(process.env.PORT ?? 3000);
