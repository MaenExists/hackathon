import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  distanceKm,
  nearestTransport,
  searchPlaces,
  type PlaceDataset,
  type PublicPlace,
} from "../lib/places.ts";
const data = JSON.parse(
  readFileSync(
    new URL("../public/data/kerala-places.json", import.meta.url),
    "utf8",
  ),
) as PlaceDataset;
test("place metadata preserves real source fields, unknowns and elevation provenance", () => {
  const munnar = data.places.find((p) => p.geonamesId === 1262463)!;
  assert.equal(munnar.district, "Idukki");
  assert.equal(munnar.population, 68000);
  assert.equal(munnar.populationYear, null);
  assert.equal(munnar.elevationKind, "DEM estimate");
  assert.equal(munnar.elevationM, 1470);
  assert.equal(munnar.sourceUrl, "https://www.geonames.org/1262463/");
  assert.equal(data.districts.length, 14);
  assert(data.transport.length > 150);
  assert(data.places.some((p) => p.population === null));
  assert(
    data.places.every((p) => p.population !== 0 && p.populationYear === null),
  );
});
test("search prioritizes exact locality names and handles aliases and diacritics", () => {
  const items = [...data.places, ...data.districts, ...data.transport];
  assert.equal(searchPlaces(items, "Munnar")[0].geonamesId, 1262463);
  assert.equal(searchPlaces(items, "Cochin")[0].name, "Kochi");
  assert(searchPlaces(items, "Ernakulam").length > 0);
  assert(searchPlaces(items, "കൊച്ചി").some((p) => p.name === "Kochi"));
});
test("nearby transport uses straight-line distance, radius limits and type diversity", () => {
  assert(
    Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.195) <
      0.01,
  );
  const origin = {
    id: "a",
    name: "Origin",
    kind: "populated place",
    lat: 10,
    lon: 76,
  } as PublicPlace;
  const near = nearestTransport(origin, [
    {
      ...origin,
      id: "r",
      name: "Rail",
      lat: 10.01,
      transportType: "Railway station",
    },
    { ...origin, id: "p", name: "Port", lat: 10.1, transportType: "Port" },
    {
      ...origin,
      id: "f",
      name: "Air",
      lat: 10.3,
      transportType: "Air facility",
    },
    { ...origin, id: "too-far", lat: 14, transportType: "Railway station" },
  ]);
  assert.deepEqual(
    near.map((p) => p.id),
    ["r", "p", "f"],
  );
  assert(near.every((p) => p.distanceKm <= 120));
});
