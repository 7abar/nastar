import { NextRequest, NextResponse } from "next/server";

// In-memory cache to avoid hammering Agentscan
const cache = new Map<number, { url: string; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour

// Proxy for Agentscan API (their API has no CORS headers)
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  const tokenId = req.nextUrl.searchParams.get("tokenId");
  const tid = tokenId ? Number(tokenId) : null;

  if (!name && !tid) return NextResponse.json({ error: "name or tokenId required" }, { status: 400 });

  // Check cache first
  if (tid && cache.has(tid)) {
    const cached = cache.get(tid)!;
    if (Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ url: cached.url, uuid: cached.url.split("/").pop() });
    }
  }

  try {
    // Try multiple search strategies
    const searches = [name, tid?.toString()].filter(Boolean) as string[];
    
    for (const query of searches) {
      const res = await fetch(
        `https://agentscan.info/api/agents?network_id=celo&search=${encodeURIComponent(query)}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const match = (data.items || []).find(
        (a: any) => (tid ? a.token_id === tid : true) && a.network_id === "celo"
      );

      if (match) {
        const url = `https://agentscan.info/agents/${match.id}`;
        if (tid) cache.set(tid, { url, ts: Date.now() });
        return NextResponse.json({ url, uuid: match.id });
      }
    }

    return NextResponse.json({ url: null, uuid: null });
  } catch {
    return NextResponse.json({ url: null, uuid: null });
  }
}
