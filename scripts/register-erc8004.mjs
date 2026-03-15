/**
 * Register Nastar agents on the real ERC-8004 Identity Registry (Celo Mainnet)
 * Contract: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 * Function: register(string metadataURI) — permissionless
 */

import { createWalletClient, createPublicClient, http, defineChain, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load PK from .env.wallet
const envPath = resolve(process.env.HOME, ".openclaw/workspace/.env.wallet");
const envContent = readFileSync(envPath, "utf-8");
const pk = envContent.match(/PRIVATE_KEY=(.+)/)?.[1]?.trim();
if (!pk) { console.error("No PRIVATE_KEY found"); process.exit(1); }

const celo = defineChain({
  id: 42220, name: "Celo", network: "celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
});

const REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ABI = [{ name: "register", type: "function", stateMutability: "nonpayable", inputs: [{ name: "metadataURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] }];

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const walletClient = createWalletClient({ account, chain: celo, transport: http() });
const publicClient = createPublicClient({ chain: celo, transport: http() });

// Build metadata
const metadata = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Nastar Protocol",
  description: "Trustless AI agent marketplace on Celo. On-chain escrow, reputation oracle, and AI dispute resolution. Hire AI agents and pay with 16 stablecoins.",
  image: "https://nastar.fun/logo-icon.png",
  external_url: "https://nastar.fun",
  version: "1.0.0",
  active: true,
  tags: ["marketplace", "escrow", "ai-agents", "reputation", "dispute-resolution", "stablecoins", "celo"],
  services: [
    { name: "web", endpoint: "https://nastar.fun" },
    { name: "api", endpoint: "https://api-production-a473.up.railway.app" },
  ],
  publisher: {
    name: "Nastar Protocol",
    website: "https://nastar.fun",
    github: "https://github.com/7abar/nastar",
  },
  supportedTrust: ["reputation", "crypto-economic"],
};

const b64 = Buffer.from(JSON.stringify(metadata)).toString("base64");
const metadataURI = `data:application/json;base64,${b64}`;

console.log("Registering on ERC-8004 Identity Registry...");
console.log("Registry:", REGISTRY);
console.log("Account:", account.address);
console.log("Metadata URI length:", metadataURI.length);

try {
  // Simulate first
  const simResult = await publicClient.simulateContract({
    address: REGISTRY,
    abi: ABI,
    functionName: "register",
    args: [metadataURI],
    account,
  });
  console.log("Simulation OK — will get token ID:", simResult.result.toString());

  // Send transaction
  const hash = await walletClient.writeContract({
    address: REGISTRY,
    abi: ABI,
    functionName: "register",
    args: [metadataURI],
  });
  console.log("TX sent:", hash);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Confirmed in block:", receipt.blockNumber.toString());
  console.log("Status:", receipt.status);
  console.log("CeloScan: https://celoscan.io/tx/" + hash);
} catch (err) {
  console.error("Failed:", err.message || err);
}
