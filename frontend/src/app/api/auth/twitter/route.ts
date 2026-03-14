import { NextRequest, NextResponse } from "next/server";

// Twitter OAuth 2.0 with PKCE
// GET /api/auth/twitter — redirect user to Twitter OAuth
export async function GET(req: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Twitter OAuth not configured" }, { status: 500 });

  const redirectUri = `${req.nextUrl.origin}/api/auth/twitter/callback`;
  const state = crypto.randomUUID();

  // Generate PKCE challenge
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "tweet.read users.read");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("tw_oauth_state", state, { httpOnly: true, maxAge: 300, path: "/" });
  res.cookies.set("tw_code_verifier", codeVerifier, { httpOnly: true, maxAge: 300, path: "/" });
  return res;
}
