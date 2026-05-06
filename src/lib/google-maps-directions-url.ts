/**
 * Google Maps Directions (web) URL with api=1.
 * All location parameters are URL-encoded (commas in lat,lng become %2C).
 */
export function buildGoogleMapsDrivingDirectionsUrl(
  originLatLng: string,
  destinationLatLng: string,
  waypointsPipe?: string,
): string {
  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originLatLng)}&destination=${encodeURIComponent(destinationLatLng)}&travelmode=driving`;
  if (waypointsPipe) {
    url += `&waypoints=${encodeURIComponent(waypointsPipe)}`;
  }
  return url;
}
