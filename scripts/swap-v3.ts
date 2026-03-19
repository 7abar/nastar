/**
 * Swap CELO → cUSD via Ubeswap V3 (Algebra fork) on Celo Mainnet
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits, getAddress, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env.wallet" });
dotenv.config({ path: "../../.env.wallet" });

const RPC = "https://forno.celo.org";
const USDm = getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a");
const CELO_TOKEN = getAddress("0x471EcE3750Da237f93B8E339c536989b8978a438");
const ROUTER = getAddress("0x5615CDAb10dc425a742d643d949a7F474C01abc4");

const ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice)) payable returns (uint256 amountOut)",
]);

const ERC20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

// Use buyer wallet (has 35 CELO)
const BUYER_PK = "0xc87c8662e6598cfd1b84e476e5ff92b3915b560154c89e7eb50e1fb51474f74d";
const account = privateKeyToAccount(BUYER_PK as `0x${string}`);
const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) });

async function main() {
  const sellAmount = parseUnits("30", 18);
  console.log(`Wallet: ${account.address}`);
  
  // Approve CELO token for router
  console.log("Approving CELO...");
  let h = await wallet.writeContract({
    address: CELO_TOKEN, abi: ERC20, functionName: "approve",
    args: [ROUTER, sellAmount],
  });
  await pub.waitForTransactionReceipt({ hash: h });
  
  // Swap via exactInputSingle
  console.log("Swapping 30 CELO → cUSD...");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  h = await wallet.writeContract({
    address: ROUTER, abi: ROUTER_ABI, functionName: "exactInputSingle",
    args: [{
      tokenIn: CELO_TOKEN,
      tokenOut: USDm,
      recipient: account.address,
      deadline,
      amountIn: sellAmount,
      amountOutMinimum: 0n, // no min for testing
      limitSqrtPrice: 0n,
    }],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: h });
  console.log(`Swap tx: ${h}`);
  
  const bal = await pub.readContract({ address: USDm, abi: ERC20, functionName: "balanceOf", args: [account.address] });
  console.log(`cUSD balance: ${formatUnits(bal, 18)}`);
}

main().catch(e => console.error(e.message?.slice(0, 300)));
