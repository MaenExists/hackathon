import type { PublicPlace } from "./places.ts";
export type SearchScope = "kerala" | "india";
export type SearchCategory = "all" | "roads" | "addresses" | "places";
export interface MapSearchResponse {
  results: PublicPlace[];
  provider: "Photon / OpenStreetMap";
  fetchedAt: string;
  cached: boolean;
  scope: SearchScope;
  category: SearchCategory;
}
export class MapSearchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function validateSearch(query: string, scope: string, category: string) {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 180 || /[\u0000-\u001f]/.test(q))
    throw new MapSearchError(
      400,
      "Enter a road, address, landmark or destination (2–180 characters).",
    );
  if (
    !["kerala", "india"].includes(scope) ||
    !["all", "roads", "addresses", "places"].includes(category)
  )
    throw new MapSearchError(
      400,
      "Choose a valid search area and feature type.",
    );
  return {
    q,
    scope: scope as SearchScope,
    category: category as SearchCategory,
  };
}
export function searchUrl(
  base: string,
  query: string,
  scope: SearchScope,
  category: SearchCategory,
) {
  const root = new URL(base);
  if (root.protocol !== "https:")
    throw new MapSearchError(503, "Map search configuration is unavailable.");
  const url = new URL(
    "api/",
    root.href.endsWith("/") ? root.href : root.href + "/",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "16");
  url.searchParams.set("lang", "en");
  url.searchParams.set("countrycode", "IN");
  url.searchParams.set("lat", "10.5");
  url.searchParams.set("lon", "76.3");
  if (scope === "kerala") url.searchParams.set("bbox", "74.7,8,77.7,13");
  else url.searchParams.set("bbox", "67,5,99,39");
  if (category === "roads") url.searchParams.append("layer", "street");
  if (category === "addresses") url.searchParams.append("layer", "house");
  if (category === "places")
    for (const layer of ["city", "locality", "district", "county", "state"])
      url.searchParams.append("layer", layer);
  return url;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 1000)
    : undefined;
}
export function photonPlaces(
  raw: unknown,
  scope: SearchScope,
  category: SearchCategory,
  fetchedAt: string,
): PublicPlace[] {
  const features = object(raw).features;
  if (!Array.isArray(features))
    throw new MapSearchError(
      502,
      "The map search service returned an unreadable response. Try again.",
    );
  const result: PublicPlace[] = [];
  const seen = new Set<string>();
  for (const f of features.slice(0, 40)) {
    const feature = object(f),
      p = object(feature.properties),
      g = object(feature.geometry);
    if (
      g.type !== "Point" ||
      !Array.isArray(g.coordinates) ||
      g.coordinates.length < 2
    )
      continue;
    const [lon, lat] = g.coordinates as unknown[];
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 5 ||
      lat > 39 ||
      lon < 67 ||
      lon > 99
    )
      continue;
    if (String(p.countrycode ?? "").toUpperCase() !== "IN") continue;
    const state = text(p.state);
    if (
      scope === "kerala" &&
      !["kerala", "കേരളം"].includes((state ?? "").toLowerCase())
    )
      continue;
    const osmType = ({ N: "node", W: "way", R: "relation" } as const)[
      p.osm_type as "N" | "W" | "R"
    ];
    if (
      !osmType ||
      !Number.isSafeInteger(p.osm_id) ||
      (p.osm_id as number) <= 0
    )
      continue;
    const key = text(p.osm_key) ?? "place",
      value = text(p.osm_value) ?? text(p.type) ?? "feature";
    const kind =
      key === "highway" || p.type === "street"
        ? "road"
        : key === "place"
          ? String(p.type ?? "place")
          : "point of interest";
    if (category === "roads" && kind !== "road") continue;
    const name =
      text(p.name) ??
      text(p.street) ??
      `${value.replaceAll("_", " ")}${p.housenumber ? " " + p.housenumber : ""}`;
    const id = `osm-${osmType}-${p.osm_id}`;
    const address: Record<string, string> = {};
    for (const field of [
      "housenumber",
      "street",
      "district",
      "city",
      "county",
      "state",
      "postcode",
      "country",
    ]) {
      const v = text(p[field]);
      if (v) address[field] = v;
    }
    const displayAddress = [
      address.housenumber,
      address.street,
      address.district,
      address.city,
      address.county,
      address.state,
      address.postcode,
      address.country,
    ]
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(", ");
    const dedupe = `${name.toLowerCase()}|${key}|${value}|${address.city ?? ""}|${address.postcode ?? ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    let bounds: PublicPlace["bounds"];
    if (
      Array.isArray(p.extent) &&
      p.extent.length === 4 &&
      p.extent.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      const [west, north, east, south] = p.extent as number[];
      if (
        south <= north &&
        west <= east &&
        south >= -85 &&
        north <= 85 &&
        west >= -180 &&
        east <= 180
      )
        bounds = [south, north, west, east];
    }
    result.push({
      id,
      name,
      kind,
      lat,
      lon,
      dataProvider: "openstreetmap",
      osmId: p.osm_id as number,
      osmType,
      address,
      displayAddress,
      state,
      country: address.country ?? "India",
      featureCode: value,
      featureLabel:
        kind === "road"
          ? `${value.replaceAll("_", " ")} road`
          : value.replaceAll("_", " "),
      sourceCategory: `${key}=${value}`,
      sourceUrl: `https://www.openstreetmap.org/${osmType}/${p.osm_id}`,
      retrievedAt: fetchedAt,
      bounds,
    });
    if (result.length >= 10) break;
  }
  return result;
}
export interface SearchDependencies {
  db: D1Database;
  fetcher?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
}
export async function searchMap(
  deps: SearchDependencies,
  query: string,
  scope: string,
  category: string,
): Promise<MapSearchResponse> {
  const input = validateSearch(query, scope, category);
  const now = (deps.now ?? Date.now)();
  const base = deps.baseUrl ?? "https://photon.komoot.io/";
  const upstream = searchUrl(base, input.q, input.scope, input.category);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `v1|${base}|${input.scope}|${input.category}|${input.q.normalize("NFC").toLocaleLowerCase()}`,
    ),
  );
  const key = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const cached = await deps.db
    .prepare(
      "SELECT payload,fetched_at FROM map_search_cache WHERE key = ? AND expires_at > ?",
    )
    .bind(key, now)
    .first<{ payload: string; fetched_at: string }>();
  if (cached)
    return {
      results: JSON.parse(cached.payload),
      provider: "Photon / OpenStreetMap",
      fetchedAt: cached.fetched_at,
      cached: true,
      scope: input.scope,
      category: input.category,
    };
  // One shared, atomic reservation across all users and Worker instances.
  const slot = await deps.db
    .prepare(
      "INSERT INTO map_search_limits (key,next_request_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET next_request_at=excluded.next_request_at WHERE map_search_limits.next_request_at <= ? RETURNING key",
    )
    .bind("photon", now + 1100, now)
    .first();
  if (!slot)
    throw new MapSearchError(429, "Map search is busy. Try again in a moment.");
  let response: Response;
  try {
    response = await (deps.fetcher ?? fetch)(upstream, {
      headers: {
        "User-Agent":
          "CorridorHackathonPrototype/1.0 (+https://github.com/MaenExists/hackathon)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new MapSearchError(
      503,
      "Online map search is unavailable. Bundled suggestions still work; try online search again shortly.",
    );
  }
  if (!response.ok)
    throw new MapSearchError(
      response.status === 429 ? 429 : 503,
      "The map search service is temporarily unavailable. Try again shortly.",
    );
  const raw = await response.text();
  if (raw.length > 1_000_000)
    throw new MapSearchError(
      502,
      "The map search response was too large. Try a more specific destination.",
    );
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new MapSearchError(
      502,
      "The map search service returned an unreadable response.",
    );
  }
  const fetchedAt = new Date(now).toISOString();
  const results = photonPlaces(payload, input.scope, input.category, fetchedAt);
  const ttl = results.length ? 7 * 86400000 : 15 * 60000;
  await deps.db.batch([
    deps.db
      .prepare("DELETE FROM map_search_cache WHERE expires_at <= ?")
      .bind(now),
    deps.db
      .prepare(
        "INSERT INTO map_search_cache (key,payload,fetched_at,expires_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at",
      )
      .bind(key, JSON.stringify(results), fetchedAt, now + ttl),
  ]);
  return {
    results,
    provider: "Photon / OpenStreetMap",
    fetchedAt,
    cached: false,
    scope: input.scope,
    category: input.category,
  };
}
