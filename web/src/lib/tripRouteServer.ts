import { estimateRealRouteDistance } from "@/lib/routing";
import { isAutoEstimableRoute } from "@/lib/tripRouteHelpers";

/**
 * Resolve de forma segura no servidor o KM estimado (ida + volta) para persistência em POST/PATCH.
 * Nunca lança exceção nem retorna valores fictícios caso o endereço não seja localizado.
 */
export async function resolveSuggestedRoundTripKm(
  origin: string,
  destination: string
): Promise<number | null> {
  if (!isAutoEstimableRoute(origin, destination)) {
    return null;
  }

  try {
    const estimate = await estimateRealRouteDistance({
      origin: origin.trim(),
      destination: destination.trim(),
    });
    if (estimate.found && estimate.round_trip_km > 0) {
      return estimate.round_trip_km;
    }
  } catch {
    // Falha silenciosa para não bloquear criação/edição da viagem
  }

  return null;
}

