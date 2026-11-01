export interface PublicPlace {
  dataProvider?: "geonames" | "openstreetmap";
  osmId?: number;
  osmType?: "node" | "way" | "relation";
  address?: Record<string, string>;
  displayAddress?: string;
  bounds?: [number, number, number, number];
  sourceCategory?: string;
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string;
  localName?: string;
  aliases?: string;
  alternativeNames?: string[];
  geonamesId?: number;
  featureCode?: string;
  featureLabel?: string;
  referenceId?: string;
  country?: string;
  state?: string;
  district?: string | null;
  districtCode?: string | null;
  subdistrict?: string | null;
  population?: number | null;
  populationYear?: number | null;
  elevationM?: number | null;
  elevationKind?: "reported" | "DEM estimate" | null;
  timezone?: string | null;
  sourceModified?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  transportType?: string;
}
export interface PlaceDataset {
  places: PublicPlace[];
  districts: PublicPlace[];
  transport: PublicPlace[];
  retrieved: string;
}
export function distanceKm(
  a: Pick<PublicPlace, "lat" | "lon">,
  b: Pick<PublicPlace, "lat" | "lon">,
): number {
  const rad = (d: number) => (d * Math.PI) / 180,
    dlat = rad(b.lat - a.lat),
    dlon = rad(b.lon - a.lon);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function nearestTransport(place: PublicPlace, features: PublicPlace[]) {
  const sorted = features
    .filter((f) => f.id !== place.id)
    .map((f) => ({ ...f, distanceKm: distanceKm(place, f) }))
    .filter((f) => f.distanceKm <= 120)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const rail = sorted
    .filter((f) => f.transportType?.startsWith("Rail"))
    .slice(0, 2);
  const air = sorted
    .filter((f) => f.transportType === "Air facility")
    .slice(0, 1);
  const water = sorted
    .filter((f) => ["Port", "Harbour"].includes(f.transportType ?? ""))
    .slice(0, 1);
  return [...rail, ...air, ...water].sort(
    (a, b) => a.distanceKm - b.distanceKm,
  );
}
export function searchPlaces(items: PublicPlace[], query: string) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const term = normalize(query.trim());
  if (!term) return [];
  const score = (p: PublicPlace) => {
    if (normalize(p.name) === term) return 0;
    if (
      normalize(p.localName ?? "") === term ||
      p.alternativeNames?.some((name) => normalize(name) === term)
    )
      return 0.5;
    return normalize(p.name).startsWith(term) ? 1 : 2;
  };
  return items
    .filter((p) =>
      normalize(
        `${p.name} ${p.localName ?? ""} ${p.aliases ?? ""} ${p.district ?? ""}`,
      ).includes(term),
    )
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        (b.population ?? 0) - (a.population ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 7);
}
