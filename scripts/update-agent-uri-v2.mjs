/**
 * Creates a new ERC-8004 agent on Nastar Protocol and sets its metadata URI to IPFS.
 * Requires owner's PRIVATE_KEY from .env.wallet.
 *
 * To run: cd ~/.openclaw/workspace/nastar && export $(grep -v '^#' ../../.env.wallet | xargs) && node scripts/update-agent-uri-v2.mjs
 */

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const PRIVATE_KEY = process.env.PRIVATE_KEY; // Owner's private key
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY not found in .env.wallet"); process.exit(1); }

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const IPFS_CID = "bafkreiefenszemjgzfjv6ikw7fbplmvg63jtzzvgo4whkv5gvquljb3xiy"; // New CID provided by user

const NEW_AGENT_URI = `ipfs://${IPFS_CID}`;
const AGENT_ID_TO_UPDATE = 1876n; // Assuming we update existing agent 1876

// Updated metadata JSON string with new IPFS CID and current timestamp
const AGENT_METADATA_JSON_STR = `{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Nastar Protocol",
  "description": "Nastar Infra Agent: Your go-to on-chain AI assistant for the Nastar Protocol ecosystem. Automates agent discovery, TrustScore analysis, escrow monitoring, and Celo-based deployments. Built for builders in the trustless AI economy — portable ERC-8004 identity, verifiable reputation, and seamless stablecoin integrations.",
  "image": "https://raw.githubusercontent.com/7abar/nastar-protocol/main/frontend/public/logo-full.png",
  "active": true,
  "services": [
    {
      "name": "MCP",
      "endpoint": "https://api.nastar.fun/.well-known/mcp.json",
      "version": "2025-06-18",
      "mcpTools": [
        "browse_agents", "get_agent", "create_deal", "check_deal", "get_reputation", "list_services", "get_balance"
      ]
    },
    {
      "name": "A2A",
      "endpoint": "https://api.nastar.fun/.well-known/agent-card.json",
      "version": "0.3.0",
      "a2aSkills": [
        "blockchain/data_analysis/transaction_analysis", "agent_orchestration/agent_discovery", "finance_and_business/escrow_management", "natural_language_processing/information_retrieval_synthesis/search"
      ]
    },
    {
      "name": "OASF",
      "endpoint": "https://github.com/agntcy/oasf/",
      "version": "0.8.0",
      "skills": [
        "blockchain/data_analysis/transaction_parsing", "blockchain/governance/proposal_analysis", "blockchain/escrow_management", "agent_orchestration/agent_registration", "natural_language_processing/information_retrieval_synthesis/search", "natural_language_processing/text_generation/report_generation"
      ],
      "domains": ["technology/blockchain", "technology/artificial_intelligence", "finance_and_business/defi"]
    },
    { "name": "web", "endpoint": "https://nastar.fun/agents/1876" },
    { "name": "agentWallet", "endpoint": "eip155:42220:0xa5844eef46b34894898b7050cef5f4d225e92fbe" }
  ],
  "registrations": [
    {
      "agentId": 1876,
      "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ],
  "supportedTrust": ["reputation", "crypto-economic"],
  "publisher": {
    "name": "Nastar Protocol",
    "github": "https://github.com/7abar/nastar-protocol",
    "twitter": "https://x.com/7abar_eth",
    "website": "https://nastar.fun"
  },
  "updatedAt": ${Math.floor(Date.now() / 1000)}
}`;

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const walletClient = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });

console.log("Owner wallet:", account.address);

// ABI for Identity Registry contract
const ABI = parseAbi([
  "function setAgentURI(uint256 agentId, string calldata newURI) external",
  "event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)",
]);

// Step 1: Update the AgentURI for the agent
console.log(`\n1. Updating AgentURI for Agent ID ${AGENT_ID_TO_UPDATE} to ${NEW_AGENT_URI}...`);
try {
  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: ABI,
    functionName: "setAgentURI",
    args: [AGENT_ID_TO_UPDATE, NEW_AGENT_URI],
  });

  console.log("TX submitted:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("CONFIRMED in block:", receipt.blockNumber.toString());
  console.log("CeloScan:", `https://celoscan.io/tx/${hash}`);

  console.log("\nAgentURI updated on-chain with new IPFS metadata.");

} catch (err) {
  console.error("Failed to update agentURI:", err.message);
  process.exit(1);
}

console.log("\nDone!");
