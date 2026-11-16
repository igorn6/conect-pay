export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getClockFallbackWeather, mapWeatherToDisplay } from "@/lib/weather";

interface ResolvedLocation {
  lat: number;
  lon: number;
  city: string | null;
  region: string | null;
  locationSource: "gps" | "vercel" | "ip";
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, "").trim();
  if (!clean) return true;
  if (clean === "::1" || clean === "127.0.0.1" || clean === "localhost") return true;
  if (clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) return true;
  return false;
}

function decodeHeaderCity(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim() || null;
  } catch {
    return raw.trim() || null;
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUserLocation(req: Request): Promise<ResolvedLocation | null> {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  // 1. Coordenadas explícitas via GPS do navegador (quando autorizado pelo usuário)
  if (latParam !== null && lonParam !== null) {
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      let city = searchParams.get("city")?.trim() || null;
      let region = searchParams.get("region")?.trim() || null;

      if (!city) {
        const rev = await fetchJsonWithTimeout<{
          city?: string;
          locality?: string;
          principalSubdivisionCode?: string;
          principalSubdivision?: string;
        }>(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
          2500
        );
        if (rev) {
          city = rev.city || rev.locality || null;
          const subCode = rev.principalSubdivisionCode || "";
          region = subCode.includes("-") ? subCode.split("-").pop() || null : rev.principalSubdivision || null;
        }
      }

      return { lat, lon, city, region, locationSource: "gps" };
    }
  }

  // 2. Headers automáticos de geolocalização da Vercel (em produção)
  const vLat = Number(req.headers.get("x-vercel-ip-latitude"));
  const vLon = Number(req.headers.get("x-vercel-ip-longitude"));
  if (
    Number.isFinite(vLat) &&
    Number.isFinite(vLon) &&
    (vLat !== 0 || vLon !== 0)
  ) {
    return {
      lat: vLat,
      lon: vLon,
      city: decodeHeaderCity(req.headers.get("x-vercel-ip-city")),
      region: decodeHeaderCity(req.headers.get("x-vercel-ip-country-region")),
      locationSource: "vercel",
    };
  }

  // 3. Fallback por IP público (útil em localhost ou provedores sem header geo)
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const realIp = req.headers.get("x-real-ip")?.trim() || "";
  const clientIp = !isPrivateOrLoopbackIp(forwarded)
    ? forwarded
    : !isPrivateOrLoopbackIp(realIp)
    ? realIp
    : "";

  const ipUrl = clientIp
    ? `https://ipwho.is/${encodeURIComponent(clientIp)}?lang=pt-BR`
    : `https://ipwho.is/?lang=pt-BR`;

  const ipGeo = await fetchJsonWithTimeout<{
    success?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
    region_code?: string;
    region?: string;
  }>(ipUrl, 3000);

  if (
    ipGeo?.success &&
    typeof ipGeo.latitude === "number" &&
    typeof ipGeo.longitude === "number"
  ) {
    return {
      lat: ipGeo.latitude,
      lon: ipGeo.longitude,
      city: ipGeo.city || null,
      region: ipGeo.region_code || ipGeo.region || null,
      locationSource: "ip",
    };
  }

  return null;
}

// GET /api/weather
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hourParam = Number(searchParams.get("hour"));
  const fallbackHour =
    Number.isFinite(hourParam) && hourParam >= 0 && hourParam <= 23
      ? hourParam
      : new Date().getHours();

  const location = await resolveUserLocation(req);
  if (!location) {
    const fb = getClockFallbackWeather(fallbackHour);
    return NextResponse.json({
      ...fb,
      city: null,
      region: null,
      temperature: null,
      weatherCode: null,
      isDay: fallbackHour >= 6 && fallbackHour < 19,
      locationSource: "clock",
      source: "fallback",
    });
  }

  const meteo = await fetchJsonWithTimeout<{
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      is_day?: number;
      precipitation?: number;
      rain?: number;
      cloud_cover?: number;
    };
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,weather_code,is_day,precipitation,rain,cloud_cover&timezone=auto`,
    3500
  );

  if (!meteo?.current) {
    const fb = getClockFallbackWeather(fallbackHour);
    return NextResponse.json({
      ...fb,
      city: location.city,
      region: location.region,
      temperature: null,
      weatherCode: null,
      isDay: fallbackHour >= 6 && fallbackHour < 19,
      locationSource: location.locationSource,
      source: "fallback",
    });
  }

  const cur = meteo.current;
  const parsedHour =
    typeof cur.time === "string" && cur.time.length >= 13
      ? Number(cur.time.slice(11, 13))
      : fallbackHour;
  const localHour = Number.isFinite(parsedHour) ? parsedHour : fallbackHour;
  const isDay = cur.is_day === 1;

  const mapped = mapWeatherToDisplay({
    weatherCode: cur.weather_code ?? null,
    isDay,
    precipitation: cur.precipitation,
    rain: cur.rain,
    cloudCover: cur.cloud_cover,
    localHour,
  });

  return NextResponse.json({
    ...mapped,
    city: location.city,
    region: location.region,
    temperature:
      typeof cur.temperature_2m === "number" ? Math.round(cur.temperature_2m) : null,
    weatherCode: cur.weather_code ?? null,
    isDay,
    locationSource: location.locationSource,
    source: "open-meteo",
  });
}
