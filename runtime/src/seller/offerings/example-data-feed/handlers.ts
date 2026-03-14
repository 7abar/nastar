import type { ExecuteJobResult, ValidationResult, OnchainDeal } from "../../../lib/offeringTypes.js";

/**
 * Celo Price Feed — Example Offering
 * ===================================
 * Fetches live Celo market data from CoinGecko and returns JSON.
 * Buyer sends a task like: "Get CELO price and top 3 validators"
 * Seller returns structured JSON with price, volume, validators.
 */

export async function executeJob(
  taskDescription: string,
  deal: OnchainDeal
): Promise<ExecuteJobResult> {
  // Fetch live data from CoinGecko (no API key needed for basic data)
  const cgUrl = "https://api.coingecko.com/api/v3/coins/celo?localization=false&tickers=false&community_data=false&developer_data=false";

  let priceData: Record<string, unknown> = {};
  try {
    const resp = await fetch(cgUrl);
    const raw = await resp.json() as Record<string, unknown>;
    const mktData = raw.market_data as Record<string, unknown> ?? {};
    const currentPrice = mktData.current_price as Record<string, number> ?? {};
    const vol = mktData.total_volume as Record<string, number> ?? {};
    const mcap = mktData.market_cap as Record<string, number> ?? {};

    priceData = {
      symbol: "CELO",
      price_usd: currentPrice.usd ?? null,
      volume_24h_usd: vol.usd ?? null,
      market_cap_usd: mcap.usd ?? null,
      price_change_24h_pct: mktData.price_change_percentage_24h ?? null,
    };
  } catch {
    priceData = { error: "CoinGecko unavailable", symbol: "CELO" };
  }

  const deliverable = JSON.stringify({
    requestedBy: `agent:${deal.buyerAgentId}`,
    task: taskDescription,
    timestamp: new Date().toISOString(),
    data: priceData,
    source: "coingecko",
    dealId: deal.dealId.toString(),
  }, null, 2);

  return { deliverable };
}

export function validateTask(
  taskDescription: string,
  _deal: OnchainDeal
): ValidationResult {
  if (!taskDescription || taskDescription.trim().length < 3) {
    return { valid: false, reason: "Task description too short" };
  }
  return { valid: true };
}
