import path from "path";
import fs from "fs/promises";

export function storageRoot() {
  return path.join(process.cwd(), "storage");
}

export async function ensureVideoDir(videoId: string) {
  const dir = path.join(storageRoot(), videoId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function publicStorageUrl(videoId: string, filename: string) {
  return `/api/storage/${videoId}/${filename}`;
}
