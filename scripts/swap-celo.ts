/**
 * Quick script: swap CELO → cUSD via Celo Exchange and fund buyer
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env.wallet" });
dotenv.config({ path: "../../.env.wallet" });

const RPC = "https://forno.celo.org";
const EXCHANGE = getAddress("0x67316300f17f063085Ca8bCa4bd3f7a5a3C66275");
const USDm = getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a");
const CELO_TOKEN = getAddress("0x471EcE3750Da237f93B8E339c536989b8978a438");

const EXCHANGE_ABI = parseAbi([
  "function getBuyTokenAmount(uint256 sellAmount, bool sellGold) view returns (uint256)",
  "function sell(uint256 sellAmount, uint256 minBuyAmount, bool sellGold) returns (uint256)",
]);

const ERC20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const pk = process.env.PRIVATE_KEY;
if (!pk) { console.error("No PRIVATE_KEY"); process.exit(1); }

const account = privateKeyToAccount(pk as `0x${string}`);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) });

async function main() {
  const sellAmount = parseUnits("30", 18); // 30 CELO
  
  console.log("Getting quote...");
  const buyAmount = await pub.readContract({
    address: EXCHANGE, abi: EXCHANGE_ABI, functionName: "getBuyTokenAmount",
    args: [sellAmount, true], // sellGold=true → sell CELO, get cUSD
  });
  console.log(`30 CELO → ${formatUnits(buyAmount, 18)} cUSD`);
  
  // Approve CELO token for Exchange
  console.log("Approving CELO...");
  let h = await wallet.writeContract({
    address: CELO_TOKEN, abi: ERC20, functionName: "approve",
    args: [EXCHANGE, sellAmount],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  
  // Sell CELO for cUSD
  console.log("Swapping...");
  const minOut = buyAmount * 95n / 100n; // 5% slippage
  h = await wallet.writeContract({
    address: EXCHANGE, abi: EXCHANGE_ABI, functionName: "sell",
    args: [sellAmount, minOut, true],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(`Swap tx: ${h}`);
  
  const bal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [account.address] });
  console.log(`cUSD balance: ${formatUnits(bal, 18)}`);
}

main().catch(console.error);
