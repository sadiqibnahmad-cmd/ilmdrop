import { NextResponse } from "next/server";
import { createServerClient } from "../../lib/supabase";
import { getUploadUrl, generateS3Key } from "../../lib/s3";
import { nanoid } from "nanoid";

export async function POST(request) {
  try {
    const body = await request.json();
    const { projectId, filename, fileType, fileSize } = body;

    // Validate input
    if (!projectId || !filename || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, filename, fileType, fileSize" },
        { status: 400 }
      );
    }

    // Enforce 2GB max
    if (fileSize > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 2GB limit" },
        { status: 400 }
      );
    }

    const db = createServerClient();

    // Verify project exists
    const { data: project, error: projErr } = await db
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create file record in DB
    const fileId = nanoid(12);
    const s3Key = generateS3Key(projectId, fileId, filename);

    const { data: file, error: fileErr } = await db
      .from("files")
      .insert({
        id: fileId,
        project_id: projectId,
        filename,
        s3_key: s3Key,
        file_type: fileType,
        file_size: fileSize,
      })
      .select()
      .single();

    if (fileErr) {
      return NextResponse.json({ error: fileErr.message }, { status: 500 });
    }

    // Generate presigned upload URL
    const uploadUrl = await getUploadUrl(s3Key, fileType, fileSize);

    return NextResponse.json({
      file,
      uploadUrl,
      // Client uploads directly to this URL via PUT
      // After upload completes, the file is immediately streamable
    });
  } catch (err) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
