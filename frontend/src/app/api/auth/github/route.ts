import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/github — redirect user to GitHub OAuth
export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GitHub OAuth not configured" }, { status: 500 });

  const redirectUri = `${req.nextUrl.origin}/api/auth/github/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("gh_oauth_state", state, { httpOnly: true, maxAge: 300, path: "/" });
  return res;
}
