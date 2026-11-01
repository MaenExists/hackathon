import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  photonPlaces,
  searchUrl,
  searchMap,
  validateSearch,
  MapSearchError,
} from "../lib/map-search.ts";
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/photon-road.json", import.meta.url), "utf8"),
);
test("live OSM road results preserve category, address, source and mapped extent", () => {
  const rows = photonPlaces(fixture, "kerala", "roads", "2026-11-01T08:00:00Z");
  assert(rows.length > 0);
  assert.equal(rows[0].name, "Banerji Road");
  assert.equal(rows[0].kind, "road");
  assert.equal(rows[0].dataProvider, "openstreetmap");
  assert(rows[0].sourceUrl?.startsWith("https://www.openstreetmap.org/way/"));
  assert.equal(rows[0].address?.city, "Ernakulam");
  assert(rows[0].bounds?.length === 4);
  assert.equal(rows[0].population, undefined);
});
test("provider restrictions exclude mismatched countries and state; unsafe IDs cannot create links", () => {
  const original = fixture.features[0];
  const wrong = {
    ...original,
    properties: { ...original.properties, state: "Tamil Nadu" },
  };
  assert.equal(
    photonPlaces({ features: [wrong] }, "kerala", "all", "now").length,
    0,
  );
  assert.equal(
    photonPlaces({ features: [wrong] }, "india", "all", "now").length,
    1,
  );
  assert.equal(
    photonPlaces(
      {
        features: [
          {
            ...original,
            properties: { ...original.properties, osm_id: "../script" },
          },
        ],
      },
      "kerala",
      "all",
      "now",
    ).length,
    0,
  );
  assert.throws(
    () => photonPlaces({ error: "bad" }, "kerala", "all", "now"),
    MapSearchError,
  );
});
test("queries and provider configuration are bounded, encoded and explicit about categories", () => {
  assert.throws(() => validateSearch("a", "kerala", "all"));
  assert.throws(() => validateSearch("road", "outside", "all"));
  assert.throws(() =>
    searchUrl("http://unsafe.invalid/", "road", "kerala", "all"),
  );
  const url = searchUrl(
    "https://photon.komoot.io/",
    "Banerji Road & shops",
    "kerala",
    "roads",
  );
  assert.equal(url.hostname, "photon.komoot.io");
  assert.equal(url.searchParams.get("q"), "Banerji Road & shops");
  assert.equal(url.searchParams.get("layer"), "street");
  assert.equal(url.searchParams.get("countrycode"), "IN");
});
function memoryDb() {
  const cache = new Map<
    string,
    { payload: string; fetched_at: string; expires: number }
  >();
  let next = 0;
  const prepare = (sql: string) => ({
    bind(...args: unknown[]) {
      return {
        sql,
        args,
        async first() {
          if (sql.startsWith("SELECT payload")) {
            const c = cache.get(String(args[0]));
            return c && c.expires > Number(args[1]) ? c : null;
          }
          if (sql.startsWith("INSERT INTO map_search_limits")) {
            if (next > Number(args[2])) return null;
            next = Number(args[1]);
            return { key: "photon" };
          }
          throw Error("Unexpected read");
        },
      };
    },
  });
  const db = {
    prepare,
    async batch(statements: { sql: string; args: unknown[] }[]) {
      for (const s of statements) {
        if (s.sql.startsWith("INSERT INTO map_search_cache"))
          cache.set(String(s.args[0]), {
            payload: String(s.args[1]),
            fetched_at: String(s.args[2]),
            expires: Number(s.args[3]),
          });
        if (s.sql.startsWith("DELETE FROM"))
          for (const [key, value] of cache)
            if (value.expires <= Number(s.args[0])) cache.delete(key);
      }
      return [];
    },
  };
  return db as unknown as D1Database;
}
test("cache hits avoid upstream traffic and a shared reservation rejects rapid misses", async () => {
  let calls = 0,
    now = 1793520000000;
  const db = memoryDb();
  const fetcher = (async () => {
    calls++;
    return Response.json(fixture);
  }) as typeof fetch;
  const deps = { db, fetcher, now: () => now };
  const first = await searchMap(deps, "Banerji Road", "kerala", "roads");
  assert.equal(first.cached, false);
  const second = await searchMap(deps, "Banerji Road", "kerala", "roads");
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  await assert.rejects(
    searchMap(deps, "Another road", "kerala", "roads"),
    (error: unknown) => error instanceof MapSearchError && error.status === 429,
  );
  now += 1200;
  await searchMap(deps, "Another road", "kerala", "roads");
  assert.equal(calls, 2);
});
test("upstream failures produce actionable errors while cache remains usable", async () => {
  const deps = {
    db: memoryDb(),
    fetcher: (async () => {
      throw Error("offline");
    }) as typeof fetch,
  };
  await assert.rejects(
    searchMap(deps, "Banerji Road", "kerala", "roads"),
    (error: unknown) =>
      error instanceof MapSearchError &&
      error.status === 503 &&
      error.message.includes("Bundled suggestions"),
  );
});
