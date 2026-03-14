/**
 * Populate Nastar marketplace with diverse agents
 * Registers 8 services across different categories
 */

import {
  createPublicClient, createWalletClient, http, parseAbi,
  formatUnits, encodeFunctionData, stringToHex, padHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoAlfajores } from "viem/chains";
import "dotenv/config";

const RPC = "https://forno.celo-sepolia.celo-testnet.org";
const CHAIN = { ...celoAlfajores, id: 11142220, name: "Celo Sepolia",
  rpcUrls: { default: { http: [RPC] } } } as any;

const SERVICE_REGISTRY = "0x1aB9810d5E135f02fC66E875a77Da8fA4e49758e" as const;
const IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const MOCK_USDC = "0x93C86be298bcF530E183954766f103B061BF64Ef" as const;

const REG_ABI = parseAbi([
  "function registerService(uint256 agentId, string name, string description, string endpoint, address paymentToken, uint256 pricePerCall, bytes32[] tags) returns (uint256)",
  "function nextServiceId() view returns (uint256)",
]);

const ID_ABI = parseAbi([
  "function register() returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
]);

const pk = process.env.PRIVATE_KEY as `0x${string}`;
if (!pk) { console.error("Set PRIVATE_KEY"); process.exit(1); }

const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

// ── Services to register ────────────────────────────────────────────────────
const SERVICES = [
  {
    name: "CeloDataFeed",
    description: "Real-time Celo ecosystem data: token prices, validator stats, block metrics, DeFi TVL. JSON API with 5-second refresh.",
    endpoint: "https://nastar.dev/agents/celo-data-feed",
    price: 2_000000n, // 2 USDC
    tags: ["data", "defi", "analytics"],
  },
  {
    name: "SmartAuditor",
    description: "Automated Solidity smart contract auditing. Scans for reentrancy, overflow, access control, gas optimization. Returns severity-rated findings.",
    endpoint: "https://nastar.dev/agents/smart-auditor",
    price: 25_000000n, // 25 USDC
    tags: ["security", "audit", "solidity"],
  },
  {
    name: "NFTMinter",
    description: "Deploy and mint NFT collections on Celo. Supports ERC-721 and ERC-1155. Handles metadata, IPFS pinning, and batch minting.",
    endpoint: "https://nastar.dev/agents/nft-minter",
    price: 10_000000n, // 10 USDC
    tags: ["nft", "mint", "creator"],
  },
  {
    name: "TweetComposer",
    description: "AI-powered crypto tweet generation. Generates engaging threads about DeFi, NFTs, and market analysis. Supports scheduled posting.",
    endpoint: "https://nastar.dev/agents/tweet-composer",
    price: 1_000000n, // 1 USDC
    tags: ["social", "content", "marketing"],
  },
  {
    name: "SwapRouter",
    description: "Finds the best swap route across Celo DEXes (Ubeswap, Curve, Mento). Compares prices, slippage, and gas. Returns optimal execution path.",
    endpoint: "https://nastar.dev/agents/swap-router",
    price: 3_000000n, // 3 USDC
    tags: ["defi", "swap", "trading"],
  },
  {
    name: "DocTranslator",
    description: "Translates technical documentation between 12 languages. Preserves code blocks, formatting, and technical terminology. Batch processing supported.",
    endpoint: "https://nastar.dev/agents/doc-translator",
    price: 5_000000n, // 5 USDC
    tags: ["translation", "docs", "i18n"],
  },
  {
    name: "ChainAnalyzer",
    description: "On-chain forensics and wallet analysis. Traces token flows, identifies whale movements, detects wash trading, and generates risk reports.",
    endpoint: "https://nastar.dev/agents/chain-analyzer",
    price: 15_000000n, // 15 USDC
    tags: ["analytics", "forensics", "risk"],
  },
  {
    name: "WebScraper",
    description: "High-performance web scraping agent. Extracts structured data from any website. Handles pagination, JavaScript rendering, and anti-bot bypass.",
    endpoint: "https://nastar.dev/agents/web-scraper",
    price: 3_000000n, // 3 USDC
    tags: ["scraping", "data", "automation"],
  },
];

async function main() {
  console.log("\n  NASTAR — Populating Marketplace\n");
  console.log(`  Wallet: ${account.address}`);
  console.log(`  Registry: ${SERVICE_REGISTRY}\n`);

  // Check/mint identity
  const balance = await pub.readContract({
    address: IDENTITY, abi: ID_ABI, functionName: "balanceOf", args: [account.address],
  });

  let agentId = 0n;
  if (balance === 0n) {
    console.log("  Minting ERC-8004 identity...");
    const h = await wallet.writeContract({
      address: IDENTITY, abi: ID_ABI, functionName: "register",
    });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("  Identity minted!");
  }

  // Find agent ID
  for (let i = 0n; i <= 200n; i++) {
    try {
      const owner = await pub.readContract({
        address: IDENTITY, abi: ID_ABI, functionName: "ownerOf", args: [i],
      });
      if (owner.toLowerCase() === account.address.toLowerCase()) {
        agentId = i;
        break;
      }
    } catch {}
  }
  console.log(`  Agent ID: #${agentId}\n`);

  // Register services
  for (let i = 0; i < SERVICES.length; i++) {
    const svc = SERVICES[i];
    console.log(`  [${i + 1}/${SERVICES.length}] Registering "${svc.name}"...`);

    try {
      const tagsBytes32 = svc.tags.map(t => padHex(stringToHex(t, { size: 32 }), { dir: "right" })) as `0x${string}`[];
      const h = await wallet.writeContract({
        address: SERVICE_REGISTRY,
        abi: REG_ABI,
        functionName: "registerService",
        args: [agentId, svc.name, svc.description, svc.endpoint, MOCK_USDC, svc.price, tagsBytes32],
      });
      const receipt = await pub.waitForTransactionReceipt({ hash: h });

      // Parse service ID from event
      const topic = "0x2f97baea4f38ff977318c4e4648cfa7b665121ba164e1cb7070d29a78f59f475";
      const log = receipt.logs.find((l: any) => l.topics[0] === topic);
      const serviceId = log ? parseInt(log.topics[1] || "0", 16) : "?";

      console.log(`    ✓ Service #${serviceId} — ${svc.name} (${formatUnits(svc.price, 6)} USDC)`);
      console.log(`      TX: https://sepolia.celoscan.io/tx/${h}`);
    } catch (err: any) {
      console.log(`    ✗ Failed: ${err.message?.slice(0, 80)}`);
    }
  }

  // Final count
  const nextId = await pub.readContract({
    address: SERVICE_REGISTRY, abi: REG_ABI, functionName: "nextServiceId",
  });
  console.log(`\n  Done! Total services on-chain: ${nextId}`);
  console.log(`  View: https://nastar-production.up.railway.app/offerings\n`);
}

main().catch(console.error);
