/**
 *  ███╗   ██╗ █████╗ ███████╗████████╗ █████╗ ██████╗
 *  ████╗  ██║██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗
 *  ██╔██╗ ██║███████║███████╗   ██║   ███████║██████╔╝
 *  ██║╚██╗██║██╔══██║╚════██║   ██║   ██╔══██║██╔══██╗
 *  ██║ ╚████║██║  ██║███████║   ██║   ██║  ██║██║  ██║
 *  ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
 *
 *  Agent Service Marketplace API — Celo x x402 x ERC-8004
 *  github.com/7abar/nastar
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { PORT, CONTRACTS, X402_CONFIG } from "./config.js";
import { publicClient, serialize } from "./lib/client.js";
import servicesRouter from "./routes/services.js";
import dealsRouter from "./routes/deals.js";

const app = express();

app.use(cors());
app.use(express.json());

// ── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    name: "Nastar API",
    version: "1.0.0",
    description: "Agent Service Marketplace on Celo — discover, hire, and pay agents",
    network: "celo-sepolia",
    contracts: CONTRACTS,
    x402: {
      enabled: X402_CONFIG.payTo !== "0x0000000000000000000000000000000000000000",
      payTo: X402_CONFIG.payTo,
      token: X402_CONFIG.token,
      pricePerCall: X402_CONFIG.priceWei.toString(),
    },
    endpoints: {
      "GET /services": "List active services (paginated)",
      "GET /services/count": "Total registered service count",
      "GET /services/:id": "Get service by ID",
      "GET /services/tag/:tag": "Services by category tag",
      "GET /services/agent/:agentId": "Services by agent NFT ID",
      "GET /services/search/query?q=": "Full-text search [x402 required]",
      "GET /deals/count": "Total deal count",
      "GET /deals/:id": "Get deal by ID",
      "GET /deals/agent/:agentId": "All deals + reputation for agent",
      "GET /deals/analytics/summary": "Marketplace-wide analytics [x402 required]",
      "GET /health": "Node + contract connectivity check",
    },
    writeOperations: {
      note: "Write operations (register service, create deal, etc.) require signed txs from the agent wallet. Use the Nastar SDK: npm install nastar-sdk",
      sdk: "https://github.com/7abar/nastar/tree/main/sdk",
    },
  });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    const [block, serviceCount, dealCount] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.readContract({
        address: CONTRACTS.SERVICE_REGISTRY,
        abi: [
          {
            type: "function",
            name: "nextServiceId",
            inputs: [],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
          },
        ],
        functionName: "nextServiceId",
      }),
      publicClient.readContract({
        address: CONTRACTS.NASTAR_ESCROW,
        abi: [
          {
            type: "function",
            name: "nextDealId",
            inputs: [],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
          },
        ],
        functionName: "nextDealId",
      }),
    ]);

    res.json(
      serialize({
        status: "ok",
        blockNumber: block,
        contracts: {
          serviceRegistry: CONTRACTS.SERVICE_REGISTRY,
          nastarEscrow: CONTRACTS.NASTAR_ESCROW,
        },
        stats: {
          totalServices: serviceCount,
          totalDeals: dealCount,
        },
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      error: (err as Error).message,
    });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/services", servicesRouter);
app.use("/deals", dealsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found. See GET / for available endpoints." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  NASTAR API running on http://localhost:${PORT}`);
  console.log(`  Network: Celo Alfajores (chain 11142220)`);
  console.log(`  ServiceRegistry: ${CONTRACTS.SERVICE_REGISTRY}`);
  console.log(`  NastarEscrow:    ${CONTRACTS.NASTAR_ESCROW}`);
  console.log(`  x402 payments:   ${X402_CONFIG.payTo !== "0x0000000000000000000000000000000000000000" ? "enabled" : "disabled (set SERVER_WALLET)"}`);
  console.log();
});

export default app;
