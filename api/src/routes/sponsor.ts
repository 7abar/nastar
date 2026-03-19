/**
 * Gas-Sponsored Agent Deployment
 *
 * Executes mint + registerService + setAgentURI on behalf of the user.
 * Gas is paid by the server wallet so users don't need CELO.
 *
 * POST /v1/sponsor/deploy
 */

import { Router, Request, Response } from "express";
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CONTRACTS } from "../config.js";

const router = Router();

const CELO_RPC = "https://forno.celo.org";

const IDENTITY_ABI = parseAbi([
  "function register() returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function setAgentURI(uint256 tokenId, string agentURI)",
]);

const SERVICE_ABI = parseAbi([
  "function registerService(uint256 agentId, string name, string description, string endpoint, address paymentToken, uint256 pricePerCall, bytes32[] tags) returns (uint256)",
  "function nextServiceId() view returns (uint256)",
]);

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

/**
 * POST /v1/sponsor/deploy
 *
 * Body:
 *   ownerAddress: string — user's wallet (will own the NFT)
 *   name: string — agent name
 *   description: string — agent description
 *   endpoint: string — API endpoint
 *   paymentToken: string — accepted token address
 *   pricePerCall: string — price in wei
 *   tags: string[] — category tags
 *
 * Returns:
 *   agentNftId, serviceId, txHashes
 */
// Anti-spam: max 3 deploys per IP per hour
const deployRateMap = new Map<string, { count: number; resetAt: number }>();
const DEPLOY_LIMIT = 3;
const DEPLOY_WINDOW = 3600_000; // 1 hour

router.post("/deploy", async (req: Request, res: Response) => {
  const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  const now = Date.now();
  const entry = deployRateMap.get(clientIp);
  if (!entry || now > entry.resetAt) {
    deployRateMap.set(clientIp, { count: 1, resetAt: now + DEPLOY_WINDOW });
  } else {
    entry.count++;
    if (entry.count > DEPLOY_LIMIT) {
      return res.status(429).json({ error: "Deploy limit reached. Max 3 agents per hour." });
    }
  }
  try {
    const {
      ownerAddress, name, description, endpoint,
      paymentToken, pricePerCall, tags,
    } = req.body;

    if (!ownerAddress || !name) {
      return res.status(400).json({ error: "ownerAddress and name are required" });
    }

    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
      return res.status(500).json({ error: "Server wallet not configured" });
    }

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(CELO_RPC),
    });

    const API_URL = process.env.API_URL || "https://api.nastar.fun";
    const txHashes: string[] = [];

    // ── 1. Mint ERC-8004 Identity NFT ──────────────────────────────────────────

    // Check if user already has an NFT
    const balance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });

    let agentNftId: number | null = null;

    if (balance === 0n) {
      // Mint new identity NFT — server pays gas
      // register() mints to msg.sender (server wallet) with auto-incremented tokenId
      const mintHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_ABI,
        functionName: "register",
      });

      const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      txHashes.push(mintHash);

      // Extract tokenId from Transfer event (topic[3])
      const transferLog = mintReceipt.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferLog && transferLog.topics[3]) {
        agentNftId = Number(BigInt(transferLog.topics[3]));
      }
    } else {
      // Already has an NFT — skip minting, use existing
      agentNftId = null; // Will be set below by scanning
    }

    if (agentNftId === null) {
      return res.status(500).json({ error: "Failed to find or mint agent NFT" });
    }

    // ── 2. Register Service ────────────────────────────────────────────────────

    const fee = BigInt(pricePerCall || "1000000000000000000"); // default 1 token
    const tagBytes = (tags || []).map((t: string) =>
      `0x${Buffer.from(t.padEnd(32, "\0")).toString("hex").slice(0, 64)}` as `0x${string}`
    );

    const svcHash = await walletClient.writeContract({
      address: CONTRACTS.SERVICE_REGISTRY as `0x${string}`,
      abi: SERVICE_ABI,
      functionName: "registerService",
      args: [
        BigInt(agentNftId),
        name,
        description || "",
        endpoint || `${API_URL}/api/agent/endpoint`,
        (paymentToken || "0x0000000000000000000000000000000000000000") as `0x${string}`,
        fee,
        tagBytes,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash: svcHash });
    txHashes.push(svcHash);

    // Get service ID
    const nextServiceId = await publicClient.readContract({
      address: CONTRACTS.SERVICE_REGISTRY as `0x${string}`,
      abi: SERVICE_ABI,
      functionName: "nextServiceId",
    });
    const serviceId = Number(nextServiceId) - 1;

    // ── 3. Set Agent Metadata URI ──────────────────────────────────────────────

    try {
      const uriHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_ABI,
        functionName: "setAgentURI",
        args: [BigInt(agentNftId), `${API_URL}/api/agent/${agentNftId}/metadata`],
      });
      await publicClient.waitForTransactionReceipt({ hash: uriHash });
      txHashes.push(uriHash);
    } catch {
      // Non-critical — metadata URI can be set later
    }

    // ── 4. Transfer ERC-8004 NFT to user's wallet ──────────────────────────────
    // register() mints to msg.sender (server). Transfer ownership to the actual user.
    try {
      const TRANSFER_ABI = parseAbi([
        "function transferFrom(address from, address to, uint256 tokenId)",
      ]);
      const transferHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: TRANSFER_ABI,
        functionName: "transferFrom",
        args: [account.address, ownerAddress as `0x${string}`, BigInt(agentNftId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: transferHash });
      txHashes.push(transferHash);
    } catch (e: any) {
      console.warn(`[sponsor] NFT transfer to ${ownerAddress} failed:`, e.message);
      // Non-fatal — user can claim later
    }

    // Auto-register on Molthunt (fire-and-forget, non-blocking)
    (async () => {
      try {
        const { registerOnMolthunt } = await import("../lib/molthunt.js");
        const { createClient } = await import("@supabase/supabase-js");
        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!sbUrl || !sbKey) return;
        const sb = createClient(sbUrl, sbKey);

        // Fetch agent data including PK from Supabase
        const { data } = await sb
          .from("registered_agents")
          .select("agent_wallet, agent_private_key, avatar, name, description")
          .eq("agent_nft_id", agentNftId);

        const agent = data?.[0];
        if (!agent?.agent_private_key) {
          console.log(`[molthunt] No agent PK found for #${agentNftId}, skipping`);
          return;
        }

        const result = await registerOnMolthunt({
          name: agent.name || req.body.name || `Agent #${agentNftId}`,
          description: agent.description || req.body.description || "",
          agentNftId,
          agentWallet: agent.agent_wallet || ownerAddress,
          agentPrivateKey: agent.agent_private_key,
          avatar: agent.avatar || "",
          templateId: req.body.templateId || "custom",
        });

        if (result.success) {
          console.log(`[molthunt] Agent #${agentNftId} registered as project ${result.projectId}`);
          // Store Molthunt project ID in Supabase
          await sb.from("registered_agents")
            .update({ molthunt_project_id: result.projectId })
            .eq("agent_nft_id", agentNftId);
        }
      } catch (e: any) {
        console.error("[molthunt] background error:", e.message);
      }
    })();

    return res.json({
      success: true,
      agentNftId,
      serviceId,
      ownerAddress,
      txHashes,
      gasSponsored: true,
    });

  } catch (err: any) {
    console.error("[sponsor] deploy error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Deploy failed" });
  }
});

/**
 * POST /v1/sponsor/mint-and-transfer
 * Mint ERC-8004 identity + transfer to user + drip gas.
 * User then calls registerService() themselves (so they're the provider).
 *
 * Body: { ownerAddress: string }
 * Returns: { agentNftId, txHashes, gasDripped }
 */
router.post("/mint-and-transfer", async (req: Request, res: Response) => {
  // Rate-limit reuses the deploy limiter
  const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  const now = Date.now();
  const entry = deployRateMap.get(clientIp);
  if (!entry || now > entry.resetAt) {
    deployRateMap.set(clientIp, { count: 1, resetAt: now + DEPLOY_WINDOW });
  } else {
    entry.count++;
    if (entry.count > DEPLOY_LIMIT) {
      return res.status(429).json({ error: "Rate limit reached. Max 3 per hour." });
    }
  }

  try {
    const { ownerAddress } = req.body;
    if (!ownerAddress) {
      return res.status(400).json({ error: "ownerAddress is required" });
    }

    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "Server wallet not configured" });

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(CELO_RPC),
    });

    const txHashes: string[] = [];

    // Check if user already has an NFT
    const balance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });

    let agentNftId: number | null = null;

    if (balance === 0n) {
      // Mint — goes to server wallet
      const mintHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_ABI,
        functionName: "register",
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      txHashes.push(mintHash);

      const transferLog = receipt.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferLog?.topics[3]) {
        agentNftId = Number(BigInt(transferLog.topics[3]));
      }
    } else {
      // Already has NFT — find it by scanning recent tokens
      // Get current total supply hint from nextServiceId or scan up to latest mint
      for (let i = 0n; i <= 5000n; i++) {
        try {
          const owner = await publicClient.readContract({
            address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
            abi: IDENTITY_ABI,
            functionName: "ownerOf",
            args: [i],
          });
          if ((owner as string).toLowerCase() === ownerAddress.toLowerCase()) {
            agentNftId = Number(i);
            break;
          }
        } catch { continue; }
      }
    }

    if (agentNftId === null) {
      // User has balance but we couldn't find their token — mint a new one
      const mintHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_ABI,
        functionName: "register",
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      txHashes.push(mintHash);

      const transferLog = receipt.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferLog?.topics[3]) {
        agentNftId = Number(BigInt(transferLog.topics[3]));
      }
    }

    if (agentNftId === null) {
      return res.status(500).json({ error: "Failed to mint or find agent NFT" });
    }

    // Transfer NFT to user (skip if user already owns it)
    if (balance === 0n) {
      const TRANSFER_ABI = parseAbi([
        "function transferFrom(address from, address to, uint256 tokenId)",
      ]);
      const transferHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: TRANSFER_ABI,
        functionName: "transferFrom",
        args: [account.address, ownerAddress as `0x${string}`, BigInt(agentNftId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: transferHash });
      txHashes.push(transferHash);
    }

    // Drip gas so user can call registerService
    let gasDripped = false;
    try {
      const userBalance = await publicClient.getBalance({ address: ownerAddress as `0x${string}` });
      if (userBalance < BigInt("5000000000000000")) { // < 0.005 CELO
        const gasHash = await walletClient.sendTransaction({
          to: ownerAddress as `0x${string}`,
          value: BigInt("10000000000000000"), // 0.01 CELO
        });
        await publicClient.waitForTransactionReceipt({ hash: gasHash });
        txHashes.push(gasHash);
        gasDripped = true;
      }
    } catch (e: any) {
      console.warn("[sponsor] gas drip failed:", e.message);
    }

    return res.json({
      success: true,
      agentNftId,
      ownerAddress,
      txHashes,
      gasDripped,
    });
  } catch (err: any) {
    console.error("[sponsor] mint-and-transfer error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Mint failed" });
  }
});

/**
 * POST /v1/sponsor/gas
 * Send a small amount of CELO to user's wallet for gas.
 * User then transacts directly (owns their NFT + services).
 *
 * Anti-exploit:
 * - Max 0.01 CELO per drip (enough for ~10 txs)
 * - Max 2 drips per address per 24h
 * - Max 5 drips per IP per 24h
 * - Only sends if user balance < 0.005 CELO
 */
const GAS_DRIP = BigInt("10000000000000000"); // 0.01 CELO
const dripByAddress = new Map<string, { count: number; resetAt: number }>();
const dripByIp = new Map<string, { count: number; resetAt: number }>();
const DRIP_WINDOW = 86400_000; // 24h
const MAX_DRIPS_ADDR = 2;
const MAX_DRIPS_IP = 5;
const MIN_BALANCE = BigInt("5000000000000000"); // 0.005 CELO — don't drip if user has more

router.post("/gas", async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "Valid address required" });
    }

    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "Sponsor wallet not configured" });

    const now = Date.now();
    const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    const addrKey = address.toLowerCase();

    // Rate limit by address
    const addrEntry = dripByAddress.get(addrKey);
    if (addrEntry && now < addrEntry.resetAt) {
      if (addrEntry.count >= MAX_DRIPS_ADDR) {
        return res.status(429).json({ error: "Gas drip limit reached for this address (max 2/day)" });
      }
      addrEntry.count++;
    } else {
      dripByAddress.set(addrKey, { count: 1, resetAt: now + DRIP_WINDOW });
    }

    // Rate limit by IP
    const ipEntry = dripByIp.get(clientIp);
    if (ipEntry && now < ipEntry.resetAt) {
      if (ipEntry.count >= MAX_DRIPS_IP) {
        return res.status(429).json({ error: "Gas drip limit reached for this IP (max 5/day)" });
      }
      ipEntry.count++;
    } else {
      dripByIp.set(clientIp, { count: 1, resetAt: now + DRIP_WINDOW });
    }

    // Check user's current CELO balance
    const userBalance = await publicClient.getBalance({ address: address as `0x${string}` });
    if (userBalance >= MIN_BALANCE) {
      return res.json({ success: true, skipped: true, reason: "User already has enough CELO", balance: Number(userBalance) / 1e18 });
    }

    // Send gas drip
    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });

    const txHash = await walletClient.sendTransaction({
      to: address as `0x${string}`,
      value: GAS_DRIP,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return res.json({
      success: true,
      txHash,
      amount: "0.01",
      currency: "CELO",
    });
  } catch (err: any) {
    console.error("[sponsor] gas drip error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Gas drip failed" });
  }
});

/**
 * GET /v1/sponsor/balance
 * Check how much CELO the sponsor wallet has left
 */
router.get("/balance", async (_req: Request, res: Response) => {
  try {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.json({ balance: "0", address: null });

    const account = privateKeyToAccount(pk as `0x${string}`);
    const balance = await publicClient.getBalance({ address: account.address });
    const celoBalance = Number(balance) / 1e18;

    res.json({
      address: account.address,
      balance: celoBalance.toFixed(4),
      canSponsor: celoBalance > 0.1,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /v1/sponsor/mint-identity
 * Mint an ERC-8004 identity for a buyer address.
 * Gas sponsored by server wallet.
 * Note: register() mints to msg.sender (server), then transfers to buyer.
 */
router.post("/mint-identity", async (req: Request, res: Response) => {
  try {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "Sponsor wallet not configured" });

    const { ownerAddress } = req.body;
    if (!ownerAddress) return res.status(400).json({ error: "ownerAddress required" });

    // Check if already has identity
    const balance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: "balanceOf",
      args: [ownerAddress as `0x${string}`],
    });

    if (balance > 0n) {
      // Find existing token ID
      for (let i = 0n; i <= 5000n; i++) {
        try {
          const owner = await publicClient.readContract({
            address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
            abi: IDENTITY_ABI,
            functionName: "ownerOf",
            args: [i],
          });
          if ((owner as string).toLowerCase() === ownerAddress.toLowerCase()) {
            return res.json({ success: true, agentNftId: Number(i), alreadyExists: true });
          }
        } catch { continue; }
      }
    }

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });

    // Mint — goes to server wallet
    const mintHash = await walletClient.writeContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: "register",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

    // Extract tokenId from Transfer event
    const transferLog = receipt.logs.find(
      (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    );
    let agentNftId = 0;
    if (transferLog?.topics[3]) {
      agentNftId = Number(BigInt(transferLog.topics[3]));
    }

    // Transfer NFT to buyer
    const TRANSFER_ABI = parseAbi([
      "function transferFrom(address from, address to, uint256 tokenId)",
    ]);
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: TRANSFER_ABI,
      functionName: "transferFrom",
      args: [account.address, ownerAddress as `0x${string}`, BigInt(agentNftId)],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return res.json({ success: true, agentNftId, txHash });
  } catch (err: any) {
    console.error("[sponsor] mint-identity error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Mint failed" });
  }
});

/**
 * POST /v1/sponsor/hire-setup
 * Prepares a user to create a real on-chain escrow deal:
 * 1. Drips gas (CELO) if needed
 * 2. Mints + transfers ERC-8004 identity if needed
 * 3. Drips cUSD for the deal amount
 * Returns: buyerTokenId, ready to approve + createDeal
 */
router.post("/hire-setup", async (req: Request, res: Response) => {
  try {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "Sponsor wallet not configured" });

    const { buyerAddress, amount } = req.body;
    if (!buyerAddress) return res.status(400).json({ error: "buyerAddress required" });

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });
    const buyer = buyerAddress as `0x${string}`;
    const dealAmount = BigInt(amount || "50000000000000000"); // default 0.05 cUSD (18 decimals)

    // 1. Gas drip
    const userBalance = await publicClient.getBalance({ address: buyer });
    let gasTx: string | null = null;
    if (userBalance < parseUnits("0.005", 18)) {
      const h = await walletClient.sendTransaction({ to: buyer, value: parseUnits("0.01", 18) });
      await publicClient.waitForTransactionReceipt({ hash: h });
      gasTx = h;
    }

    // 2. Identity NFT
    let buyerTokenId = 0;
    const idBalance = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: "balanceOf",
      args: [buyer],
    });

    if (idBalance > 0n) {
      // Find existing token
      for (let i = 2600n; i <= 2700n; i++) {
        try {
          const owner = await publicClient.readContract({
            address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
            abi: IDENTITY_ABI,
            functionName: "ownerOf",
            args: [i],
          });
          if ((owner as string).toLowerCase() === buyer.toLowerCase()) {
            buyerTokenId = Number(i);
            break;
          }
        } catch { continue; }
      }
    }

    if (buyerTokenId === 0) {
      // Mint + transfer
      const mintHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: IDENTITY_ABI,
        functionName: "register",
      });
      const mintRec = await publicClient.waitForTransactionReceipt({ hash: mintHash });
      const log = mintRec.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (log?.topics[3]) buyerTokenId = Number(BigInt(log.topics[3]));

      const TRANSFER_ABI = parseAbi(["function transferFrom(address,address,uint256)"]);
      const tfHash = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY as `0x${string}`,
        abi: TRANSFER_ABI,
        functionName: "transferFrom",
        args: [account.address, buyer, BigInt(buyerTokenId)],
      });
      await publicClient.waitForTransactionReceipt({ hash: tfHash });
    }

    // 3. Drip cUSD for the deal
    const cUSD = (CONTRACTS as any).USDm || (CONTRACTS as any).cUSD || "0x765DE816845861e75A25fCA122bb6898B8B1282a";
    const ERC20_ABI = parseAbi(["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);

    const buyerCusd = await publicClient.readContract({
      address: cUSD as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [buyer],
    });

    let cusdTx: string | null = null;
    if (buyerCusd < dealAmount) {
      const needed = dealAmount - buyerCusd;
      const h = await walletClient.writeContract({
        address: cUSD as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [buyer, needed],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      cusdTx = h;
    }

    return res.json({
      success: true,
      buyerTokenId,
      gasTx,
      cusdTx,
      escrowAddress: CONTRACTS.NASTAR_ESCROW,
      paymentToken: cUSD,
      amount: dealAmount.toString(),
    });
  } catch (err: any) {
    console.error("[sponsor] hire-setup error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Setup failed" });
  }
});

/**
 * POST /v1/sponsor/complete-deal
 * Server (seller) accepts + delivers a deal created by the buyer.
 */
router.post("/complete-deal", async (req: Request, res: Response) => {
  try {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "Sponsor wallet not configured" });

    const { dealId, task } = req.body;
    if (dealId === undefined) return res.status(400).json({ error: "dealId required" });

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });

    const ESCROW_ABI = parseAbi([
      "function acceptDeal(uint256)",
      "function deliverDeal(uint256,string)",
      "function getDeal(uint256) view returns (tuple(uint256 serviceId, uint256 buyerAgentId, uint256 sellerAgentId, address buyer, address seller, address paymentToken, uint256 amount, string taskDescription, string deliveryProof, uint8 status, uint256 deadline, uint256 createdAt, uint256 completedAt, bool autoConfirm, address judgeAddress))",
    ]);

    // Execute agent to get result
    let result = `Task completed: ${task || "Executed successfully"}`;
    try {
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      if (ANTHROPIC_KEY) {
        const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 600,
            system: "You are a professional AI agent on Nastar Protocol. Execute the task and deliver a clear, structured result. Be specific and actionable.",
            messages: [{ role: "user", content: task || "Complete the requested task" }],
          }),
        });
        const llmData: any = await llmRes.json();
        result = llmData.content?.[0]?.text || result;
      }
    } catch {}

    // Accept deal
    const acceptHash = await walletClient.writeContract({
      address: CONTRACTS.NASTAR_ESCROW as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "acceptDeal",
      args: [BigInt(dealId)],
    });
    await publicClient.waitForTransactionReceipt({ hash: acceptHash });

    // Deliver deal (autoConfirm=true will auto-complete)
    const deliverHash = await walletClient.writeContract({
      address: CONTRACTS.NASTAR_ESCROW as `0x${string}`,
      abi: ESCROW_ABI,
      functionName: "deliverDeal",
      args: [BigInt(dealId), result.slice(0, 500)],
    });
    await publicClient.waitForTransactionReceipt({ hash: deliverHash });

    return res.json({ success: true, dealId, result, deliverTx: deliverHash });
  } catch (err: any) {
    console.error("[sponsor] complete-deal error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Complete failed" });
  }
});

export default router;
