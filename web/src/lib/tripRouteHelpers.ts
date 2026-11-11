/**
 * Helpers compartilhados (client & server safe) para rotas de ajuda de custos.
 */

export const GENERIC_TRIP_DESTINATION = "prospecção externa de clientes";

export function isAutoEstimableRoute(origin: string, destination: string): boolean {
  const cleanOrigin = origin.trim();
  const cleanDest = destination.trim();
  if (cleanOrigin.length < 4 || cleanDest.length < 4) return false;
  if (cleanDest.toLowerCase() === GENERIC_TRIP_DESTINATION) return false;
  return true;
}

export function buildRoutePairKey(origin: string, destination: string): string {
  return `${origin.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
}

export function buildGoogleMapsDirectionsUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.trim())}&destination=${encodeURIComponent(destination.trim())}`;
}

