import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// POST — Create a new share link
export async function POST(request) {
  try {
    const body = await request.json();
    const { projectId, password, expiresInDays } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const db = createServerClient();
    const token = nanoid(10); // Short, URL-friendly token

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
    }

    const { data: link, error } = await db
      .from("share_links")
      .insert({
        project_id: projectId,
        token,
        password_hash: passwordHash,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${token}`;

    return NextResponse.json({
      token: link.token,
      url: shareUrl,
      hasPassword: !!passwordHash,
      expiresAt: link.expires_at,
    });
  } catch (err) {
    console.error("Share API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — Validate a share link token
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const password = searchParams.get("password");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const db = createServerClient();

    const { data: link, error } = await db
      .from("share_links")
      .select("*, projects(*, files(*, comments(*)))")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    // Check password
    if (link.password_hash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required", needsPassword: true },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(password, link.password_hash);
      if (!valid) {
        return NextResponse.json(
          { error: "Incorrect password", needsPassword: true },
          { status: 401 }
        );
      }
    }

    // Return project with files and comments
    return NextResponse.json({
      project: link.projects,
      token: link.token,
    });
  } catch (err) {
    console.error("Share validation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
