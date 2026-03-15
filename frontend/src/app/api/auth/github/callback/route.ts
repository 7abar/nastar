import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/github/callback — exchange code for token, fetch profile
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("gh_oauth_state")?.value;

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/settings?error=github_invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // Fetch user profile (read-only)
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const user = await userRes.json();

    const profile = {
      platform: "GitHub",
      username: user.login,
      displayName: user.name || user.login,
      avatar: user.avatar_url,
      url: user.html_url,
      bio: user.bio || "",
      followers: user.followers,
      repos: user.public_repos,
    };

    // Redirect back with profile data encoded
    const encoded = encodeURIComponent(JSON.stringify(profile));
    const res = NextResponse.redirect(`${origin}/settings?social=${encoded}`);
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return NextResponse.redirect(`${origin}/settings?error=github_failed`);
  }
}
