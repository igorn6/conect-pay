export type WeatherVisualCondition =
  | "STORM"
  | "RAIN"
  | "CLOUDY"
  | "NIGHT"
  | "SUNSET"
  | "SUNNY";

export interface WeatherMappingInput {
  weatherCode: number | null;
  isDay: boolean;
  precipitation?: number | null;
  rain?: number | null;
  cloudCover?: number | null;
  localHour: number;
}

export interface WeatherMappingResult {
  condition: WeatherVisualCondition;
  label: string;
  bgImage: string;
}

const STORM_CODES = new Set([95, 96, 99]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const CLOUDY_CODES = new Set([2, 3, 45, 48]);

function getWmoPortugueseLabel(code: number | null, isDay: boolean, localHour: number): string {
  switch (code) {
    case 0:
      return isDay ? (localHour >= 17 ? "Fim de tarde" : "Céu limpo") : "Noite limpa";
    case 1:
      return isDay ? "Poucas nuvens" : "Noite clara";
    case 2:
      return "Parcialmente nublado";
    case 3:
      return "Nublado";
    case 45:
    case 48:
      return "Neblina";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "Garoa";
    case 61:
    case 80:
      return "Chuva leve";
    case 63:
    case 81:
      return "Chuva moderada";
    case 65:
    case 66:
    case 67:
    case 82:
      return "Chuva forte";
    case 95:
    case 96:
    case 99:
      return "Tempestade";
    default:
      return isDay ? (localHour >= 17 ? "Fim de tarde" : "Céu limpo") : "Noite";
  }
}

export function getClockFallbackWeather(localHour: number): WeatherMappingResult {
  if (localHour >= 19 || localHour < 6) {
    return { condition: "NIGHT", label: "Noite", bgImage: "/weather/night.jpg" };
  }
  if (localHour >= 17) {
    return { condition: "SUNSET", label: "Fim de tarde", bgImage: "/weather/sunset.jpg" };
  }
  return { condition: "SUNNY", label: "Céu limpo", bgImage: "/weather/sunny.jpg" };
}

/**
 * Converte código WMO + precipitação + cobertura de nuvens + período do dia
 * na imagem de fundo (/weather/*.jpg) e descrição em português.
 */
export function mapWeatherToDisplay({
  weatherCode,
  isDay,
  precipitation,
  rain,
  cloudCover,
  localHour,
}: WeatherMappingInput): WeatherMappingResult {
  const code = typeof weatherCode === "number" && Number.isFinite(weatherCode) ? weatherCode : null;
  const hasRainAmount = (Number(precipitation) || 0) > 0.05 || (Number(rain) || 0) > 0.05;

  if (code !== null && STORM_CODES.has(code)) {
    return {
      condition: "STORM",
      label: getWmoPortugueseLabel(code, isDay, localHour),
      bgImage: "/weather/rainy.jpg",
    };
  }

  if ((code !== null && RAIN_CODES.has(code)) || hasRainAmount) {
    return {
      condition: "RAIN",
      label: getWmoPortugueseLabel(code ?? 61, isDay, localHour),
      bgImage: "/weather/rainy.jpg",
    };
  }

  const isOvercast =
    (code !== null && CLOUDY_CODES.has(code)) ||
    (isDay && (Number(cloudCover) || 0) >= 65);

  if (isOvercast) {
    if (!isDay && code === 2) {
      return {
        condition: "NIGHT",
        label: "Noite com nuvens",
        bgImage: "/weather/night.jpg",
      };
    }
    return {
      condition: "CLOUDY",
      label: getWmoPortugueseLabel(code ?? 3, isDay, localHour),
      bgImage: "/weather/cloudy.jpg",
    };
  }

  if (!isDay || localHour >= 19 || localHour < 6) {
    return {
      condition: "NIGHT",
      label: getWmoPortugueseLabel(code, false, localHour),
      bgImage: "/weather/night.jpg",
    };
  }

  if (localHour >= 17) {
    return {
      condition: "SUNSET",
      label: getWmoPortugueseLabel(code, true, localHour),
      bgImage: "/weather/sunset.jpg",
    };
  }

  return {
    condition: "SUNNY",
    label: getWmoPortugueseLabel(code, true, localHour),
    bgImage: "/weather/sunny.jpg",
  };
}
