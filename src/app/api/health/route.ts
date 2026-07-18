import { NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/db";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL || "";
  let dataMounted = false;
  let storageMounted = false;
  try {
    const mounts = fs.readFileSync("/proc/mounts", "utf8");
    dataMounted = /\s\/app\/data\s/.test(mounts);
    storageMounted = /\s\/app\/storage\s/.test(mounts);
  } catch {
    // local windows/dev
  }

  const settingsCount = await prisma.appSetting.count().catch(() => -1);
  const videosCount = await prisma.video.count().catch(() => -1);

  const persistent = dataMounted || databaseUrl.includes("/app/data/");
  const warning =
    process.env.NODE_ENV === "production" && !dataMounted
      ? "Volume /app/data não detectado. Configure Mount no EasyPanel ou as keys sumirão no redeploy."
      : null;

  return NextResponse.json({
    ok: true,
    databaseUrl: databaseUrl.replace(/\/\/.*@/, "//***@"),
    dataMounted,
    storageMounted,
    settingsCount,
    videosCount,
    warning,
    persistentOk: process.env.NODE_ENV !== "production" || dataMounted,
  });
}
