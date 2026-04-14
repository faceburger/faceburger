import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "admin_session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
    }

    if (!process.env.ADMIN_PASSWORD) {
      console.error("ADMIN_PASSWORD environment variable is not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (password === process.env.ADMIN_PASSWORD) {
      const store = await cookies();
      store.set(COOKIE, "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  } catch (err) {
    console.error("[auth] POST error:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const store = await cookies();
    store.delete(COOKIE);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth] DELETE error:", err);
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
