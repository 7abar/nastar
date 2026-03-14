import { NextRequest, NextResponse } from "next/server";

// GET /api/auth/twitter/callback — exchange code for token, fetch profile
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("tw_oauth_state")?.value;
  const codeVerifier = req.cookies.get("tw_code_verifier")?.value;

  if (!code || !state || state !== savedState || !codeVerifier) {
    return NextResponse.redirect(`${req.nextUrl.origin}/settings?error=twitter_invalid_state`);
  }

  try {
    const clientId = process.env.TWITTER_CLIENT_ID!;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || "";
    const redirectUri = `${req.nextUrl.origin}/api/auth/twitter/callback`;

    // Exchange code for access token
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // Fetch user profile (read-only)
    const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,description,public_metrics,username", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();
    const user = userData.data;

    const profile = {
      platform: "Twitter",
      username: user.username,
      displayName: user.name,
      avatar: user.profile_image_url,
      url: `https://x.com/${user.username}`,
      bio: user.description || "",
      followers: user.public_metrics?.followers_count || 0,
    };

    const encoded = encodeURIComponent(JSON.stringify(profile));
    const res = NextResponse.redirect(`${req.nextUrl.origin}/settings?social=${encoded}`);
    res.cookies.delete("tw_oauth_state");
    res.cookies.delete("tw_code_verifier");
    return res;
  } catch (err) {
    console.error("Twitter OAuth error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/settings?error=twitter_failed`);
  }
}
