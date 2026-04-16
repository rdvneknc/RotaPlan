import type { Coordinates, Student } from "./types";

const COORD_PATTERNS = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,            // @37.123,34.456,17z
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,       // ?q=37.123,34.456
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,      // ?ll=37.123,34.456
  /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,       // place/37.123,34.456
  /dir\/(-?\d+\.\d+),(-?\d+\.\d+)/,         // dir/37.123,34.456
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,         // !3d37.123!4d34.456
];

function extractFromUrl(url: string): Coordinates | null {
  for (const pattern of COORD_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

export async function resolveShortUrl(shortUrl: string): Promise<string> {
  const res = await fetch(shortUrl, { redirect: "follow" });
  return res.url;
}

function isShortMapsUrl(url: string): boolean {
  return url.includes("goo.gl/maps") || url.includes("maps.app.goo.gl");
}

function isGoogleMapsUrl(url: string): boolean {
  return (
    url.includes("google.com/maps") ||
    url.includes("google.com.tr/maps") ||
    url.includes("maps.google.com") ||
    isShortMapsUrl(url)
  );
}

export async function parseMapsUrl(
  raw: string
): Promise<{ coords: Coordinates; resolvedUrl: string } | { error: string }> {
  const url = raw.trim();

  if (!isGoogleMapsUrl(url)) {
    return { error: "Geçerli bir Google Maps linki giriniz." };
  }

  if (isShortMapsUrl(url)) {
    try {
      const resolved = await resolveShortUrl(url);
      const coords = extractFromUrl(resolved);
      if (coords) return { coords, resolvedUrl: resolved };
      return { error: "Kısa linkten koordinat çıkarılamadı. Lütfen tam linki deneyin." };
    } catch {
      return { error: "Kısa link çözümlenemedi. Lütfen tam linki kopyalayın." };
    }
  }

  const coords = extractFromUrl(url);
  if (coords) return { coords, resolvedUrl: url };

  return { error: "Linkten koordinat bulunamadı. Haritada konumu seçip tekrar kopyalayın." };
}

/**
 * Tekil konum açma (şoför / liste). Önce kayıtlı lat/lng ile pin — rota linkindeki duraklarla aynı nokta.
 * Sadece `mapsUrl` kullanıldığında göreli URL veya mobilde zayıf çözümlenen paylaşım linkleri hatalı hedef verebiliyor.
 */
export function studentMapOpenUrl(student: Pick<Student, "lat" | "lng" | "mapsUrl">): string | null {
  const { lat, lng, mapsUrl } = student;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const raw = (mapsUrl || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}
