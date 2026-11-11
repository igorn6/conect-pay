/**
 * Serviço de Roteirização Real e Geocodificação para Ajuda de Custos.
 * Combina âncoras verificadas, Photon (Komoot), Nominatim (OpenStreetMap)
 * e cálculo de distância viária real via OSRM (Open Source Routing Machine).
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
  source: "anchor" | "photon" | "nominatim";
}

export interface RealRouteEstimate {
  one_way_km: number;
  round_trip_km: number;
  duration_minutes: number | null;
  confidence: "alta" | "media" | "baixa";
  resolved_origin: string;
  resolved_destination: string | null;
  note: string;
  found: boolean;
}

// Bounding box geográfico da Bahia (com folga nas divisas)
const BAHIA_BBOX = {
  minLon: -46.8,
  minLat: -18.5,
  maxLon: -37.2,
  maxLat: -8.3,
};

// Pontos âncora conhecidos para resolução instantânea (0ms) e máxima precisão
const KNOWN_ANCHORS: Array<{
  match: (norm: string) => boolean;
  lat: number;
  lon: number;
  label: string;
}> = [
  {
    match: (norm) =>
      norm.includes("praia de iporanga") ||
      norm.includes("condominio praia do sol") ||
      norm.includes("42700-000") ||
      norm.includes("42700000") ||
      norm.includes("42702-260"),
    lat: -12.8933877,
    lon: -38.2999258,
    label: "Condomínio Praia do Sol, Ipitanga, Lauro de Freitas - BA",
  },
];

function normalizeText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isInBahia(lat: number, lon: number): boolean {
  return (
    lat >= BAHIA_BBOX.minLat &&
    lat <= BAHIA_BBOX.maxLat &&
    lon >= BAHIA_BBOX.minLon &&
    lon <= BAHIA_BBOX.maxLon
  );
}

function hasExplicitStateOrCountry(text: string): boolean {
  const norm = normalizeText(text);
  return (
    /\b(ba|sp|rj|mg|se|pe|al|ce|df|pr|sc|rs|go|mt|ms|pa|am|es|pb|rn|pi|ma|to|ro|ac|ap|rr)\b/.test(
      norm
    ) ||
    norm.includes("bahia") ||
    norm.includes("brasil") ||
    norm.includes("brazil")
  );
}

function isStreetLikeQuery(text: string): boolean {
  const norm = normalizeText(text);
  return /\b(rua|r\.|av\.|avenida|travessa|tv\.|rodovia|estrada|alameda|praca|largo|via)\b/.test(
    norm
  );
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

function scorePhotonFeature(feature: PhotonFeature, rawQuery: string): number {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return -1000;
  const [lon, lat] = coords;

  if (props.countrycode && props.countrycode.toUpperCase() !== "BR") return -1000;

  let score = 0;
  if (isInBahia(lat, lon)) score += 100;
  if (normalizeText(props.state || "") === "bahia") score += 50;

  const osmKey = props.osm_key || "";
  const osmVal = props.osm_value || "";
  const streetQuery = isStreetLikeQuery(rawQuery);
  const featureName = normalizeText(props.name || "");
  const featureCity = normalizeText(props.city || "");
  const queryNorm = normalizeText(rawQuery);

  // Match exato do nome completo digitado (ex: "Salvador Shopping")
  if (featureName && featureName === queryNorm) {
    score += 120;
  } else if (featureName && queryNorm.includes(featureName)) {
    score += 45;
  }

  // Match combinado de nome + cidade presentes na busca (ex: "Centro de Feira de Santana")
  if (
    featureName &&
    featureCity &&
    featureName !== featureCity &&
    queryNorm.includes(featureName) &&
    queryNorm.includes(featureCity)
  ) {
    score += 90;
  }

  if (!streetQuery) {
    // Prioriza cidades, municípios, bairros e localidades em vez de ruas homônimas em outras cidades
    if (osmKey === "place") {
      if (["city", "town", "municipality"].includes(osmVal)) score += 85;
      else if (["village", "suburb", "district", "neighbourhood", "quarter"].includes(osmVal))
        score += 65;
      else score += 40;
    } else if (osmKey === "boundary" && osmVal === "administrative") {
      score += 75;
    } else if (["landuse", "amenity", "shop", "tourism", "building"].includes(osmKey)) {
      score += 50;
    } else if (osmKey === "highway") {
      if (
        featureName.startsWith("rua ") ||
        featureName.startsWith("avenida ") ||
        featureName.startsWith("travessa ")
      ) {
        score -= 35;
      } else {
        score += 10;
      }
    }
  } else {
    if (osmKey === "highway" || osmKey === "building" || osmKey === "landuse") {
      score += 55;
    }
  }

  return score;
}

async function queryPhoton(searchText: string, rawQuery: string): Promise<GeoPoint | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      searchText
    )}&lat=-12.89&lon=-38.30&limit=8`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const features: PhotonFeature[] = (data.features || []).filter(
      (f: PhotonFeature) => Array.isArray(f.geometry?.coordinates) && f.geometry!.coordinates!.length >= 2
    );
    if (features.length === 0) return null;

    const ranked = features
      .map((f) => ({ f, score: scorePhotonFeature(f, rawQuery) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;

    const best = ranked[0].f;
    const [lon, lat] = best.geometry!.coordinates!;
    const p = best.properties || {};
    const labelParts = [p.name, p.district, p.city, p.state].filter(
      (v, i, arr) => v && arr.indexOf(v) === i
    );

    return {
      lat,
      lon,
      label: labelParts.join(", ") || rawQuery,
      source: "photon",
    };
  } catch {
    return null;
  }
}

async function queryNominatim(searchText: string): Promise<GeoPoint | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&viewbox=-46.8,-8.3,-37.2,-18.5&q=${encodeURIComponent(
      searchText
    )}&limit=5`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ConectPay/2.1 (https://conect-pay.vercel.app)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    const inBahia = list.find((item: { lat: string; lon: string }) =>
      isInBahia(parseFloat(item.lat), parseFloat(item.lon))
    );
    const chosen = inBahia || list[0];

    return {
      lat: parseFloat(chosen.lat),
      lon: parseFloat(chosen.lon),
      label: String(chosen.display_name || searchText).split(",").slice(0, 3).join(","),
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

/**
 * Geocodifica um endereço com fallback progressivo:
 * 1. Âncoras fixas verificadas
 * 2. Busca completa no Photon (com viés para Bahia, Brasil)
 * 3. Busca no Nominatim (com viewbox da Bahia)
 * 4. Limpeza progressiva de termos não-geográficos (condomínio, cliente, visita, etc.)
 * 5. Janela deslizante de palavras-chave (cidades/bairros contidos no texto)
 */
export async function smartGeocodeAddress(rawAddress: string): Promise<GeoPoint | null> {
  const trimmed = String(rawAddress || "").trim();
  if (!trimmed || trimmed.length < 2) return null;

  const norm = normalizeText(trimmed);
  for (const anchor of KNOWN_ANCHORS) {
    if (anchor.match(norm)) {
      return {
        lat: anchor.lat,
        lon: anchor.lon,
        label: anchor.label,
        source: "anchor",
      };
    }
  }

  const buildQualifiedQuery = (q: string) =>
    hasExplicitStateOrCountry(q) ? `${q}, Brasil` : `${q}, Bahia, Brasil`;

  // 1. Photon na busca completa
  let hit = await queryPhoton(buildQualifiedQuery(trimmed), trimmed);
  if (hit) return hit;

  // 2. Nominatim na busca completa
  hit = await queryNominatim(buildQualifiedQuery(trimmed));
  if (hit) return hit;

  // 3. Limpeza de palavras descritivas que frequentemente atrapalham geocoders (ex: "Condomínio Horto", "Visita Cliente")
  const cleanedTokens = trimmed
    .replace(
      /\b(condom[ií]nio|loteamento|residencial|edif[ií]cio|cliente|visita|prospec[cç][aã]o|empresa|fazenda|s[ií]tio|ch[aá]cara|loja|posto|obra|polo industrial)\b/gi,
      " "
    )
    .replace(/\b(em|na|no|para|pro|pra)\b/gi, " ")
    .replace(/[-,/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedTokens && cleanedTokens.length >= 3 && normalizeText(cleanedTokens) !== norm) {
    hit = await queryPhoton(buildQualifiedQuery(cleanedTokens), cleanedTokens);
    if (hit) return hit;

    hit = await queryNominatim(buildQualifiedQuery(cleanedTokens));
    if (hit) return hit;
  }

  // 4. Segmentos separados por hífen, vírgula ou barra + janelas de palavras
  const segments = trimmed
    .split(/[-,/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  const words = cleanedTokens.split(/\s+/).filter((w) => w.length >= 2);
  const candidates = new Set<string>();

  for (const seg of segments) candidates.add(seg);
  if (words.length >= 3) {
    for (let i = 0; i <= words.length - 3; i++) {
      candidates.add(words.slice(i, i + 3).join(" "));
    }
  }
  if (words.length >= 2) {
    for (let i = 0; i <= words.length - 2; i++) {
      candidates.add(words.slice(i, i + 2).join(" "));
    }
  }
  if (words.length >= 1) {
    for (const w of words) {
      if (w.length >= 4) candidates.add(w);
    }
  }

  for (const cand of candidates) {
    hit = await queryPhoton(buildQualifiedQuery(cand), cand);
    if (hit) return hit;
  }

  return null;
}

/** Distância geodésica em linha reta (km) via fórmula de Haversine */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcula a distância real de condução de carro (ida e volta) pelas rodovias/vias.
 */
export async function estimateRealRouteDistance(input: {
  origin: string;
  destination: string;
}): Promise<RealRouteEstimate> {
  const originText = String(input.origin || "").trim();
  const destText = String(input.destination || "").trim();

  if (!originText || !destText) {
    return {
      one_way_km: 0,
      round_trip_km: 0,
      duration_minutes: null,
      confidence: "baixa",
      resolved_origin: originText,
      resolved_destination: null,
      note: "Informe origem e destino para calcular a rota.",
      found: false,
    };
  }

  const [originGeo, destGeo] = await Promise.all([
    smartGeocodeAddress(originText),
    smartGeocodeAddress(destText),
  ]);

  if (!originGeo || !destGeo) {
    return {
      one_way_km: 0,
      round_trip_km: 0,
      duration_minutes: null,
      confidence: "baixa",
      resolved_origin: originGeo?.label || originText,
      resolved_destination: destGeo?.label || null,
      note: !destGeo
        ? "Não foi possível localizar o destino no mapa. Tente informar o nome da cidade ou bairro (ex: 'Conceição do Jacuípe - BA')."
        : "Não foi possível localizar o endereço de origem no mapa.",
      found: false,
    };
  }

  // Consulta rota real de carro via OSRM
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originGeo.lon},${originGeo.lat};${destGeo.lon},${destGeo.lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });

    if (osrmRes.ok) {
      const osrmJson = await osrmRes.json();
      const route = osrmJson?.routes?.[0];
      if (route && typeof route.distance === "number" && route.distance > 0) {
        const oneWayKm = Math.round((route.distance / 1000) * 10) / 10;
        const roundTripKm = Math.round((route.distance / 1000) * 2);
        const durationMin =
          typeof route.duration === "number" ? Math.round(route.duration / 60) : null;

        return {
          one_way_km: oneWayKm,
          round_trip_km: roundTripKm,
          duration_minutes: durationMin,
          confidence: "alta",
          resolved_origin: originGeo.label,
          resolved_destination: destGeo.label,
          note: `Rota viária real até ${destGeo.label}: ${oneWayKm.toLocaleString(
            "pt-BR"
          )} km ida${durationMin ? ` (~${durationMin} min)` : ""} = ${roundTripKm} km (ida + volta).`,
          found: true,
        };
      }
    }
  } catch {
    // Segue para fallback geométrico com fator viário caso OSRM oscile
  }

  // Fallback geométrico realista (linha reta x fator de tortuosidade rodoviária 1.30)
  const straightKm = haversineKm(originGeo.lat, originGeo.lon, destGeo.lat, destGeo.lon);
  const oneWayEstimated = Math.round(straightKm * 1.3 * 10) / 10;
  const roundTripEstimated = Math.round(oneWayEstimated * 2);

  return {
    one_way_km: oneWayEstimated,
    round_trip_km: roundTripEstimated,
    duration_minutes: null,
    confidence: "media",
    resolved_origin: originGeo.label,
    resolved_destination: destGeo.label,
    note: `Estimativa geográfica até ${destGeo.label}: ${oneWayEstimated.toLocaleString(
      "pt-BR"
    )} km ida = ${roundTripEstimated} km (ida + volta).`,
    found: true,
  };
}
