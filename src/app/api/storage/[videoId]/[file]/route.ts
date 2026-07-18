import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { storageRoot } from "@/lib/storage";

type Params = { params: Promise<{ videoId: string; file: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { videoId, file } = await params;
  if (file.includes("..") || videoId.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const full = path.join(storageRoot(), videoId, file);
  try {
    const data = await fs.readFile(full);
    const ext = path.extname(file).toLowerCase();
    const type =
      ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".mp4"
          ? "video/mp4"
          : ext === ".srt"
            ? "application/x-subrip"
            : ext === ".json"
              ? "application/json"
              : ext === ".txt"
                ? "text/plain; charset=utf-8"
                : "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
