/**
 * Simulate 5 completed deals to populate leaderboard + recent jobs
 */

import {
  createPublicClient, createWalletClient, http, parseAbi, keccak256, toBytes, formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoAlfajores } from "viem/chains";
import "dotenv/config";

const RPC = "https://forno.celo-sepolia.celo-testnet.org";
const CHAIN = { ...celoAlfajores, id: 11142220, name: "Celo Sepolia",
  rpcUrls: { default: { http: [RPC] } } } as any;

const ESCROW = "0xEE51f3CA1bcDeb58a94093F759BafBC9157734AF" as const;
const IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const MOCK_USDC = "0x93C86be298bcF530E183954766f103B061BF64Ef" as const;

const ESCROW_ABI = parseAbi([
  "function createDeal(uint256 serviceId, uint256 buyerAgentId, uint256 sellerAgentId, address paymentToken, uint256 amount, string taskDescription, uint256 deadline, bool autoConfirm) returns (uint256)",
  "function acceptDeal(uint256 dealId)",
  "function deliverDeal(uint256 dealId, string proof)",
  "function nextDealId() view returns (uint256)",
]);
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
]);
const ID_ABI = parseAbi([
  "function register() returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
]);

const sellerPk = process.env.PRIVATE_KEY as `0x${string}`;
const buyerPk = keccak256(toBytes(sellerPk + "nastar-demo-buyer")) as `0x${string}`;

const sellerAccount = privateKeyToAccount(sellerPk);
const buyerAccount = privateKeyToAccount(buyerPk);

const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) });
const sellerWallet = createWalletClient({ account: sellerAccount, chain: CHAIN, transport: http(RPC) });
const buyerWallet = createWalletClient({ account: buyerAccount, chain: CHAIN, transport: http(RPC) });

const DEALS = [
  { serviceId: 0, amount: 2_000000n, task: "Fetch Celo token prices and validator stats", proof: "ipfs://QmCeloDataResult001" },
  { serviceId: 3, amount: 1_000000n, task: "Write 5 crypto tweets about Celo DeFi", proof: "ipfs://QmTweetThread001" },
  { serviceId: 7, amount: 3_000000n, task: "Scrape top 100 NFT collections from OpenSea", proof: "ipfs://QmScrapedNFTs001" },
  { serviceId: 4, amount: 3_000000n, task: "Find best cUSD to USDT swap route on Celo", proof: "ipfs://QmSwapRoute001" },
  { serviceId: 5, amount: 5_000000n, task: "Translate Nastar README to Spanish and Korean", proof: "ipfs://QmTranslation001" },
];

async function findAgentId(address: string): Promise<bigint> {
  for (let i = 0n; i <= 200n; i++) {
    try {
      const owner = await pub.readContract({ address: IDENTITY, abi: ID_ABI, functionName: "ownerOf", args: [i] });
      if (owner.toLowerCase() === address.toLowerCase()) return i;
    } catch {}
  }
  return 0n;
}

async function main() {
  console.log("\n  NASTAR — Simulating Deals\n");
  console.log(`  Seller: ${sellerAccount.address}`);
  console.log(`  Buyer:  ${buyerAccount.address}\n`);

  // Ensure buyer has identity
  const buyerBal = await pub.readContract({ address: IDENTITY, abi: ID_ABI, functionName: "balanceOf", args: [buyerAccount.address] });
  if (buyerBal === 0n) {
    console.log("  Minting buyer identity...");
    const h = await buyerWallet.writeContract({ address: IDENTITY, abi: ID_ABI, functionName: "register" });
    await pub.waitForTransactionReceipt({ hash: h });
  }

  const sellerAgentId = await findAgentId(sellerAccount.address);
  const buyerAgentId = await findAgentId(buyerAccount.address);
  console.log(`  Seller Agent: #${sellerAgentId}`);
  console.log(`  Buyer Agent:  #${buyerAgentId}\n`);

  // Mint tokens for buyer
  const totalNeeded = DEALS.reduce((sum, d) => sum + d.amount, 0n);
  console.log(`  Minting ${formatUnits(totalNeeded, 6)} USDC for buyer...`);
  const mintH = await buyerWallet.writeContract({
    address: MOCK_USDC, abi: ERC20_ABI, functionName: "mint",
    args: [buyerAccount.address, totalNeeded],
  });
  await pub.waitForTransactionReceipt({ hash: mintH });

  // Approve escrow
  const appH = await buyerWallet.writeContract({
    address: MOCK_USDC, abi: ERC20_ABI, functionName: "approve",
    args: [ESCROW, totalNeeded],
  });
  await pub.waitForTransactionReceipt({ hash: appH });

  // Run deals
  for (let i = 0; i < DEALS.length; i++) {
    const d = DEALS[i];
    console.log(`  [${i + 1}/${DEALS.length}] "${d.task.slice(0, 50)}..." (${formatUnits(d.amount, 6)} USDC)`);

    // Create deal (autoConfirm = true)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
    const createH = await buyerWallet.writeContract({
      address: ESCROW, abi: ESCROW_ABI, functionName: "createDeal",
      args: [BigInt(d.serviceId), buyerAgentId, sellerAgentId, MOCK_USDC, d.amount, d.task, deadline, true],
    });
    const createR = await pub.waitForTransactionReceipt({ hash: createH });
    const dealTopic = "0x6bb122e4b14a41d111379967e6fd6c18cdd1cab504eea94e1765d3bded713ce6";
    const dealLog = createR.logs.find((l: any) => l.topics[0] === dealTopic);
    const dealId = dealLog ? BigInt(dealLog.topics[1] || "0") : 0n;
    console.log(`    Created deal #${dealId}`);

    // Accept
    const accH = await sellerWallet.writeContract({
      address: ESCROW, abi: ESCROW_ABI, functionName: "acceptDeal", args: [dealId],
    });
    await pub.waitForTransactionReceipt({ hash: accH });
    console.log(`    Accepted`);

    // Deliver (auto-completes because autoConfirm=true)
    const delH = await sellerWallet.writeContract({
      address: ESCROW, abi: ESCROW_ABI, functionName: "deliverDeal", args: [dealId, d.proof],
    });
    await pub.waitForTransactionReceipt({ hash: delH });
    console.log(`    Delivered + auto-completed!`);
  }

  const nextId = await pub.readContract({ address: ESCROW, abi: ESCROW_ABI, functionName: "nextDealId" });
  console.log(`\n  Done! Total deals on-chain: ${nextId}`);
  console.log(`  View: https://nastar-production.up.railway.app/leaderboard\n`);
}

main().catch(console.error);
