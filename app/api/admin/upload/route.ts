import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadImage } from "@/lib/cloudinary";
import sharp from "sharp";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const store = await cookies();
    if (store.get("admin_session")?.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
    }

    const raw = Buffer.from(await file.arrayBuffer());

    // Resize to 1200×800, cropped to fill, convert to WebP at 85% quality
    let optimized: Buffer;
    try {
      optimized = await sharp(raw)
        .resize({ width: 1200, height: 800, fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (sharpErr) {
      console.error("[upload] Image processing error:", sharpErr);
      return NextResponse.json({ error: "Failed to process image" }, { status: 422 });
    }

    let url: string;
    try {
      url = await uploadImage(optimized);
    } catch (cloudinaryErr) {
      console.error("[upload] Cloudinary upload error:", cloudinaryErr);
      return NextResponse.json({ error: "Failed to upload image" }, { status: 502 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
