import { NextResponse } from "next/server";
import { getDownloadUrl } from "../../../lib/s3";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const filename = searchParams.get("filename");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  try {
    const url = await getDownloadUrl(key, filename || "file");
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}