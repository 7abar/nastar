import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

// POST /api/auth/telegram — verify Telegram Login Widget callback
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "Telegram auth not configured" }, { status: 500 });

  try {
    const data = await req.json();
    const { hash, ...rest } = data;

    // Verify hash per Telegram Login Widget spec
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const checkString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join("\n");
    const hmac = createHmac("sha256", secret).update(checkString).digest("hex");

    if (hmac !== hash) {
      return NextResponse.json({ error: "Invalid Telegram auth" }, { status: 403 });
    }

    // Check auth_date is recent (within 5 minutes)
    const authDate = parseInt(data.auth_date);
    if (Date.now() / 1000 - authDate > 300) {
      return NextResponse.json({ error: "Auth expired" }, { status: 403 });
    }

    const profile = {
      platform: "Telegram",
      username: data.username || "",
      displayName: `${data.first_name || ""}${data.last_name ? " " + data.last_name : ""}`.trim(),
      avatar: data.photo_url || "",
      url: data.username ? `https://t.me/${data.username}` : "",
      telegramId: data.id,
    };

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Telegram auth error:", err);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
