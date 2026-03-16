/**
 * POST /v1/wallet/withdraw
 * Send tokens from user's custodial wallet to any address
 */
import { Router, Request, Response } from "express";
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";

const router = Router();
const CELO_RPC = "https://forno.celo.org";
const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || process.env.PRIVATE_KEY?.slice(2, 66) || "0".repeat(64);

function decrypt(data: string): string {
  const [ivHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(64, "0").slice(0, 64), "hex"), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const TOKENS: Record<string, { address: string; decimals: number }> = {
  cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 },
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
  USDT: { address: "0x48065fbbe25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
  CELO: { address: "native", decimals: 18 },
};

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

router.post("/", async (req: Request, res: Response) => {
  try {
    const { ownerAddress, to, token, amount } = req.body;

    if (!ownerAddress || !to || !token || !amount) {
      return res.status(400).json({ error: "Required: ownerAddress, to, token, amount" });
    }

    if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: "Invalid destination address" });
    }

    const tokenInfo = TOKENS[token];
    if (!tokenInfo) {
      return res.status(400).json({ error: `Unsupported token. Use: ${Object.keys(TOKENS).join(", ")}` });
    }

    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    if (!sbUrl || !sbKey) return res.status(500).json({ error: "DB not configured" });

    const sb = createClient(sbUrl, sbKey);
    const { data } = await sb
      .from("user_wallets")
      .select("wallet_address, encrypted_key")
      .eq("owner_address", ownerAddress.toLowerCase());

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No wallet found" });
    }

    const pk = decrypt(data[0].encrypted_key);
    const account = privateKeyToAccount(pk as Hex);
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });

    const amountBn = BigInt(amount);

    // Sponsor gas if needed
    const celoBalance = await publicClient.getBalance({ address: account.address });
    if (celoBalance < BigInt("10000000000000000")) {
      const sponsorPk = process.env.PRIVATE_KEY;
      if (sponsorPk) {
        const sponsorAccount = privateKeyToAccount(sponsorPk as Hex);
        const sponsorWallet = createWalletClient({ account: sponsorAccount, chain: celo, transport: http(CELO_RPC) });
        const gasHash = await sponsorWallet.sendTransaction({
          to: account.address,
          value: BigInt("50000000000000000"),
        });
        await publicClient.waitForTransactionReceipt({ hash: gasHash });
      }
    }

    let txHash: string;

    if (token === "CELO") {
      // Native transfer
      txHash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: amountBn,
      });
    } else {
      // ERC-20 transfer
      txHash = await walletClient.writeContract({
        address: tokenInfo.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, amountBn],
      });
    }

    await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

    return res.json({
      success: true,
      txHash,
      token,
      amount: formatUnits(amountBn, tokenInfo.decimals),
      to,
    });
  } catch (err: any) {
    console.error("[wallet] withdraw error:", err.message);
    return res.status(500).json({ error: err.message?.slice(0, 200) || "Withdraw failed" });
  }
});

export default router;
