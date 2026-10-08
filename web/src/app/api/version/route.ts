import { NextResponse } from "next/server";
import { APP_VERSION, APP_BUILD_DATE } from "@/constants/version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      buildDate: APP_BUILD_DATE,
      timestamp: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
