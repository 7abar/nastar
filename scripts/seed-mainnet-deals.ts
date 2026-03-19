/**
 * Seed real on-chain deals on Celo Mainnet
 * 
 * Server wallet = seller (owns service NFTs)
 * Generated buyer wallet = buyer (separate to avoid SelfDeal revert)
 * Uses Ubeswap V3 router to swap CELO → cUSD
 */

import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits, getAddress, encodeFunctionData } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env.wallet" });
dotenv.config({ path: "../../.env.wallet" });

const RPC = "https://forno.celo.org";

const USDm = getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a");
const CELO_TOKEN = getAddress("0x471EcE3750Da237f93B8E339c536989b8978a438");
const ESCROW = getAddress("0x132ab4b07849a5cee5104c2be32b32f9240b97ff");
const IDENTITY = getAddress("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
const UBESWAP_ROUTER = getAddress("0xC73d61d192FB994157168Fb56730FdEc64C9Cb8F"); // Ubeswap V2 router

const ERC20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
]);

const ID_ABI = parseAbi([
  "function register() returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function transferFrom(address,address,uint256)",
]);

const ESCROW_ABI = parseAbi([
  "function createDeal(uint256,uint256,uint256,address,uint256,string,uint256,bool) returns (uint256)",
  "function confirmDelivery(uint256,string)",
  "function nextDealId() view returns (uint256)",
]);

const ROUTER_ABI = parseAbi([
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function getAmountsOut(uint256 amountIn, address[]) view returns (uint256[])",
]);

const pk = process.env.PRIVATE_KEY;
if (!pk) { console.error("No PRIVATE_KEY"); process.exit(1); }

const serverAccount = privateKeyToAccount(pk as `0x${string}`);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const serverWallet = createWalletClient({ account: serverAccount, chain: celo, transport: http(RPC) });

async function wait(hash: `0x${string}`) {
  return pub.waitForTransactionReceipt({ hash });
}

async function findTokenId(owner: `0x${string}`): Promise<bigint | null> {
  for (let i = 0n; i <= 3000n; i++) {
    try {
      const o = await pub.readContract({ address: IDENTITY, abi: ID_ABI, functionName: "ownerOf", args: [i] });
      if ((o as string).toLowerCase() === owner.toLowerCase()) return i;
    } catch { continue; }
  }
  return null;
}

async function mintIdentity(wallet: any): Promise<bigint> {
  const h = await wallet.writeContract({ address: IDENTITY, abi: ID_ABI, functionName: "register" });
  const r = await wait(h);
  const log = r.logs.find(l => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
  return log?.topics[3] ? BigInt(log.topics[3]) : 0n;
}

async function main() {
  console.log("=== Seeding Mainnet On-Chain Deals ===\n");
  console.log(`Server (seller): ${serverAccount.address}`);

  // Generate buyer wallet
  const buyerPk = generatePrivateKey();
  const buyerAccount = privateKeyToAccount(buyerPk);
  const buyerWallet = createWalletClient({ account: buyerAccount, chain: celo, transport: http(RPC) });
  console.log(`Buyer: ${buyerAccount.address}`);

  // Fund buyer with CELO for gas
  console.log("\n1. Funding buyer wallet with CELO...");
  let h = await serverWallet.sendTransaction({ to: buyerAccount.address, value: parseUnits("5", 18) });
  await wait(h);
  console.log("   Sent 5 CELO for gas");

  // Swap CELO → cUSD via Ubeswap for buyer
  console.log("\n2. Swapping CELO → cUSD via Ubeswap...");
  const swapAmount = parseUnits("30", 18); // 30 CELO ≈ $15

  // Send CELO to buyer for swapping
  h = await serverWallet.sendTransaction({ to: buyerAccount.address, value: swapAmount });
  await wait(h);

  try {
    // Get expected output
    const path = [CELO_TOKEN, USDm];
    const amounts = await pub.readContract({
      address: UBESWAP_ROUTER, abi: ROUTER_ABI, functionName: "getAmountsOut",
      args: [swapAmount, path],
    });
    const minOut = (amounts[1] as bigint) * 90n / 100n; // 10% slippage
    console.log(`   Expected: ~${formatUnits(amounts[1] as bigint, 18)} cUSD`);

    const swapHash = await buyerWallet.writeContract({
      address: UBESWAP_ROUTER, abi: ROUTER_ABI, functionName: "swapExactETHForTokens",
      args: [minOut, path, buyerAccount.address, BigInt(Math.floor(Date.now() / 1000) + 600)],
      value: swapAmount,
    });
    await wait(swapHash);
    console.log(`   Swap tx: ${swapHash}`);
  } catch (e: any) {
    console.error(`   Ubeswap swap failed: ${e.message?.slice(0, 150)}`);
    console.log("   Trying direct cUSD transfer from server...");
    
    // Fallback: use whatever cUSD the server has, or try Mento direct
    const serverBal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [serverAccount.address] });
    if (serverBal > parseUnits("0.5", 18)) {
      const txh = await serverWallet.writeContract({
        address: USDm, abi: ERC20, functionName: "transfer",
        args: [buyerAccount.address, serverBal],
      });
      await wait(txh);
      console.log(`   Transferred ${formatUnits(serverBal, 18)} cUSD from server`);
    }
  }

  const buyerBal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [buyerAccount.address] });
  console.log(`   Buyer cUSD balance: ${formatUnits(buyerBal, 18)}`);

  if (buyerBal < parseUnits("0.1", 18)) {
    console.error("\n   Not enough cUSD. You may need to manually send cUSD to the buyer wallet.");
    console.log(`   Buyer address: ${buyerAccount.address}`);
    console.log(`   Buyer PK: ${buyerPk}`);
    process.exit(1);
  }

  // Mint buyer identity
  console.log("\n3. Minting buyer identity NFT...");
  const buyerTokenId = await mintIdentity(buyerWallet);
  console.log(`   Buyer token ID: ${buyerTokenId}`);

  // Find seller (server) agent token IDs from the services
  // Services are registered under specific agent IDs. We need to find which tokens the server owns.
  console.log("\n4. Finding seller agent IDs...");
  
  // The server wallet registered services under specific agentIds during deploy
  // These agent tokens are now owned by various users (transferred after mint)
  // For seeding, we need the server to own seller tokens. Let's check.
  const serverTokenId = await findTokenId(serverAccount.address);
  console.log(`   Server owns token: ${serverTokenId}`);

  // We need multiple seller agent IDs. Let's mint new ones for the server.
  // But wait - services are registered under specific agentIds.
  // The existing services point to agentIds like 1876, 1860, etc.
  // Those tokens might not be owned by the server anymore.
  // Let's check who owns the service's agentIds:
  
  const serviceAgentIds = [1876, 1860, 1870, 1880, 1885, 1890, 1895];
  for (const aid of serviceAgentIds) {
    try {
      const owner = await pub.readContract({ address: IDENTITY, abi: ID_ABI, functionName: "ownerOf", args: [BigInt(aid)] });
      console.log(`   Agent #${aid} owner: ${(owner as string).slice(0, 10)}...`);
    } catch {
      console.log(`   Agent #${aid} — not found`);
    }
  }

  // Approve cUSD for escrow
  console.log("\n5. Approving cUSD for escrow...");
  h = await buyerWallet.writeContract({
    address: USDm, abi: ERC20, functionName: "approve",
    args: [ESCROW, buyerBal],
  });
  await wait(h);

  // Create deals
  const deals = [
    { serviceId: 0, sellerAgentId: 1876, amount: "2", task: "Analyze CELO/USD market and provide 24h trading signal", complete: true, proof: "CELO/USD bullish — RSI 42, support $0.48. Target $0.58. Accumulate below $0.50." },
    { serviceId: 2, sellerAgentId: 1860, amount: "0.05", task: "Research wallet 0xA584 activity — summarize last 7 days", complete: true, proof: "47 txs in 7d. Primary: NFT minting + Ubeswap DeFi. Net flow: +12 CELO." },
    { serviceId: 2, sellerAgentId: 1860, amount: "0.05", task: "Analyze Mento governance proposal #42 — impact assessment", complete: true, proof: "Proposal: Add XOF stablecoin. Impact: West Africa expansion. Recommendation: Vote YES." },
    { serviceId: 1, sellerAgentId: 1870, amount: "0.5", task: "Process batch payment: 5 cUSD to 3 community contributors", complete: true, proof: "3 transfers totaling 15 cUSD processed. All confirmed on-chain." },
    { serviceId: 3, sellerAgentId: 1880, amount: "1", task: "Convert 50 cUSD → KESm and send to Nairobi merchant", complete: true, proof: "Remittance: 50 cUSD → 6,450 KESm at rate 129.0. Delivered." },
    { serviceId: 5, sellerAgentId: 1876, amount: "2", task: "Write 8-tweet thread about Nastar Protocol launch", complete: true, proof: "Thread delivered: 8 tweets — protocol overview, escrow, marketplace. Ready to publish." },
    { serviceId: 6, sellerAgentId: 1890, amount: "2", task: "Generate weekly DAO treasury report", complete: true, proof: "Treasury: $2.1M total, $340K spent. Grants 60%, Ops 25%, Dev 15%." },
    { serviceId: 0, sellerAgentId: 1876, amount: "2", task: "Execute DCA: buy 10 CELO weekly for portfolio rebalance", complete: true, proof: "DCA executed: 10 CELO at $0.51 via Mento. Portfolio updated." },
    { serviceId: 4, sellerAgentId: 1885, amount: "1", task: "Set up EUR/USD hedge with EURm and cUSD", complete: false },
    { serviceId: 7, sellerAgentId: 1895, amount: "1", task: "Optimize yield across Celo DeFi protocols", complete: false },
  ];

  console.log(`\n6. Creating ${deals.length} deals on-chain...`);
  let created = 0;
  
  for (const deal of deals) {
    try {
      const amount = parseUnits(deal.amount, 18);
      
      // Check balance
      const bal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [buyerAccount.address] });
      if (bal < amount) {
        console.log(`   Skipping (insufficient balance: ${formatUnits(bal, 18)} < ${deal.amount})`);
        continue;
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7);
      
      const dealHash = await buyerWallet.writeContract({
        address: ESCROW, abi: ESCROW_ABI, functionName: "createDeal",
        args: [
          BigInt(deal.serviceId), buyerTokenId, BigInt(deal.sellerAgentId),
          USDm, amount, deal.task, deadline, true,
        ],
      });
      await wait(dealHash);
      
      const nextId = await pub.readContract({ address: ESCROW, abi: ESCROW_ABI, functionName: "nextDealId" });
      const dealId = Number(nextId) - 1;
      created++;
      console.log(`   Deal #${dealId}: ${deal.task.slice(0, 50)}... (${deal.amount} cUSD)`);

      if (deal.complete) {
        // Server (seller) confirms delivery
        const confHash = await serverWallet.writeContract({
          address: ESCROW, abi: ESCROW_ABI, functionName: "confirmDelivery",
          args: [BigInt(dealId), deal.proof || "Completed"],
        });
        await wait(confHash);
        console.log(`   Deal #${dealId} → COMPLETED`);
      } else {
        console.log(`   Deal #${dealId} → IN PROGRESS`);
      }
    } catch (e: any) {
      console.error(`   FAILED: ${e.message?.slice(0, 200)}`);
    }
  }

  console.log(`\n=== Done! Created ${created} on-chain deals ===`);
  
  const finalBal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [buyerAccount.address] });
  console.log(`Buyer remaining cUSD: ${formatUnits(finalBal, 18)}`);
}

main().catch(console.error);
