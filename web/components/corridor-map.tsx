"use client";
import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Compass,
  Maximize,
  Minimize,
  X,
  Crosshair,
} from "lucide-react";
import type * as Leaflet from "leaflet";
import type { GeoJsonObject } from "geojson";
import { places, corridors, corridorName } from "../data/geography";
import type { CaseRecord, ForecastRow } from "../lib/types";

import PlaceProfile from "./place-profile";
import MapFeatureSearch from "./map-feature-search";
import { type PublicPlace as Location, type PlaceDataset } from "../lib/places";
import {
  substanceSignals,
  transportSignals,
  evidenceSignals,
  FORECAST_COLOR,
  reviewPattern,
} from "../lib/map-signals";
import type { Feature, Polygon, MultiPolygon } from "geojson";

type Engine = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  boundaries: Leaflet.LayerGroup;
  evidence: Leaflet.LayerGroup;
  locations: Leaflet.LayerGroup;
  tiles: Leaflet.TileLayer;
  focus: Leaflet.LayerGroup;
};
const KERALA: Leaflet.LatLngBoundsLiteral = [
  [8.15, 74.75],
  [12.85, 77.6],
];
const fallbackLocations: Location[] = places.map((p) => ({
  ...p,
  kind: "district reference",
}));
function label(text: string) {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}
function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function CorridorMap({
  records,
  selected,
  onSelect,
  forecast,
  showHypotheses,
  showPoints,
  setShowPoints,
  focusedDistrict = "all",
  searchText,
  onSearchTextChange,
  searchRequest,
}: {
  records: CaseRecord[];
  selected: string;
  onSelect: (id: string) => void;
  forecast: ForecastRow[];
  showHypotheses: boolean;
  showPoints: boolean;
  setShowPoints: (x: boolean) => void;
  focusedDistrict?: string;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchRequest: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [tileState, setTileState] = useState("loading");
  const [street, setStreet] = useState(true),
    [districts, setDistricts] = useState(true),
    [localPoints, setLocalPoints] = useState(true),
    [expanded, setExpanded] = useState(false),
    [focusKerala, setFocusKerala] = useState(true),
    [colorBy, setColorBy] = useState<"substance" | "transport" | "evidence">("substance");
  const [transport, setTransport] = useState<Location[]>([]);
  const [locations, setLocations] = useState<Location[]>(fallbackLocations),
    [chosen, setChosen] = useState<Location | null>(null);
  const [view, setView] = useState({ zoom: 7, lat: 10.5, lon: 76.3, tick: 0 });
  const previousSelected = useRef(selected),
    previousDistrict = useRef(focusedDistrict);
  useEffect(() => {
    let cancelled = false,
      observer: ResizeObserver | undefined;
    async function initialize() {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;
        const map = L.map(container.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          touchZoom: true,
          doubleClickZoom: true,
          keyboard: true,
          zoomSnap: 0.25,
          zoomDelta: 1,
          wheelPxPerZoomLevel: 120,
          wheelDebounceTime: 30,
          minZoom: 5,
          maxZoom: 19,
          maxBounds: [
            [5, 67],
            [39, 99],
          ],
          maxBoundsViscosity: 0.6,
          zoomAnimation: !reducedMotion(),
          fadeAnimation: !reducedMotion(),
        });
        map.fitBounds(KERALA, { padding: [32, 60], animate: false });
        map.createPane("kerala-focus");
        map.getPane("kerala-focus")!.style.zIndex = "320";
        map.createPane("kerala-outline");
        map.getPane("kerala-outline")!.style.zIndex = "365";
        const focus = L.layerGroup().addTo(map);
        map.createPane("districts");
        map.getPane("districts")!.style.zIndex = "350";
        map.createPane("evidence");
        map.getPane("evidence")!.style.zIndex = "450";
        const boundaries = L.layerGroup().addTo(map),
          evidence = L.layerGroup().addTo(map),
          locationLayer = L.layerGroup().addTo(map);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            maxNativeZoom: 19,
            keepBuffer: 2,
            className: "street-tiles",
            crossOrigin: "anonymous",
          },
        );
        let failures = 0;
        tiles.on("loading", () => {
          failures = 0;
        });
        tiles.on("tileerror", () => {
          failures++;
          if (!cancelled) setTileState("unavailable");
        });
        tiles.on("load", () => {
          if (!cancelled) setTileState(failures ? "unavailable" : "ready");
        });
        tiles.addTo(map);
        L.control
          .scale({ imperial: false, position: "bottomright", maxWidth: 90 })
          .addTo(map);
        const refresh = () => {
          const c = map.getCenter();
          if (!cancelled)
            setView((v) => ({
              zoom: map.getZoom(),
              lat: c.lat,
              lon: c.lng,
              tick: v.tick + 1,
            }));
        };
        map.on("moveend zoomend resize", refresh);
        refresh();
        engine.current = {
          L,
          map,
          boundaries,
          evidence,
          locations: locationLayer,
          tiles,
          focus,
        };
        observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(container.current);
        setReady(true);
        const geographic = await Promise.allSettled(
          [
            "/data/land.geojson",
            "/data/kerala.geojson",
            "/data/kerala-state.geojson",
          ].map((url) =>
            fetch(url).then((r) => {
              if (!r.ok) throw Error();
              return r.json() as Promise<GeoJsonObject>;
            }),
          ),
        );
        if (cancelled) return;
        for (let i = 0; i < 2; i++) {
          const result = geographic[i];
          if (result.status === "fulfilled")
            L.geoJSON(result.value, {
              pane: "districts",
              interactive: false,
              style: {
                color: i ? "#707070" : "#303030",
                weight: i ? 1 : 0.6,
                fillColor: "#000000",
                fillOpacity: i ? 0.04 : 0.08,
              },
            }).addTo(boundaries);
        }
        const state = geographic[2];
        if (state.status === "fulfilled") {
          const feature = state.value as Feature<Polygon | MultiPolygon>;
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;
          const holes = polygons
            .flat()
            .map((ring) =>
              ring.map(([lon, lat]) => [lat, lon] as Leaflet.LatLngTuple),
            );
          const world: Leaflet.LatLngTuple[] = [
            [-85, -180],
            [-85, 180],
            [85, 180],
            [85, -180],
          ];
          L.polygon([world, ...holes], {
            pane: "kerala-focus",
            stroke: false,
            fillColor: "#000000",
            fillOpacity: 0.73,
            fillRule: "evenodd",
            interactive: false,
            className: "kerala-focus-mask",
          }).addTo(focus);
          L.geoJSON(feature, {
            pane: "kerala-outline",
            interactive: false,
            style: {
              color: "#e5f0ec",
              weight: 2,
              opacity: 0.94,
              fillColor: "#ffffff",
              fillOpacity: 0.025,
              className: "kerala-state-outline",
            },
          }).addTo(focus);
        }
        if (geographic[1].status === "rejected")
          setMapError(
            "District boundary overlay unavailable. Street map and evidence remain available.",
          );
      } catch {
        if (!cancelled)
          setMapError(
            "The map could not initialize. Reload the workspace to try again.",
          );
      }
    }
    initialize();
    fetch("/data/kerala-places.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<PlaceDataset>;
      })
      .then((data) => {
        if (!cancelled) {
          setLocations([
            ...fallbackLocations.filter((p) => p.state !== "Kerala"),
            ...data.districts,
            ...data.places,
            ...data.transport,
          ]);
          setTransport(data.transport);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      observer?.disconnect();
      engine.current?.map.remove();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (street) {
      if (!e.map.hasLayer(e.tiles)) {
        setTileState("loading");
        e.tiles.addTo(e.map);
      }
    } else {
      e.tiles.remove();
      setTileState("off");
    }
  }, [street, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (districts) e.boundaries.addTo(e.map);
    else e.boundaries.remove();
  }, [districts, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (focusKerala) e.focus.addTo(e.map);
    else e.focus.remove();
  }, [focusKerala, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const { L, map, evidence } = e;
    evidence.clearLayers();
    const coordinates = (
      c: (typeof corridors)[number],
    ): Leaflet.LatLngTuple[] =>
      [c.origin, ...c.transit, c.destination].map((id) => {
        const p = places.find((p) => p.id === id)!;
        return [p.lat, p.lon];
      });
    if (showHypotheses)
      for (const f of forecast.slice(0, 5)) {
        const c = corridors.find((c) => c.id === f.corridorId);
        if (!c) continue;
        L.polyline(coordinates(c), {
          pane: "evidence",
          color: FORECAST_COLOR,
          className: "forecast-corridor",
          weight: Math.min(10, Math.max(4, Math.round(f.estimate * 0.75))),
          opacity: 0.8,
          dashArray: "4 10",
          interactive: true,
        })
          .bindTooltip(
            label(
              `⚡ Projected Inflow: ${corridorName(c.id)} · ~${f.estimate} cases / month predicted`,
            ),
            { sticky: true, className: "evidence-tooltip" },
          )
          .addTo(evidence);
      }
    for (const c of corridors) {
      const rows = records.filter((r) => r.corridorId === c.id);
      if (!rows.length) continue;
      const status = rows.some((r) => r.status === "documented")
        ? "documented"
        : rows.some((r) => r.status === "disputed")
          ? "disputed"
          : "unreviewed";
      const hitTarget = L.polyline(coordinates(c), {
        pane: "evidence",
        color: "transparent",
        weight: 18,
        opacity: 0,
        className: "map-route-hit",
      }).addTo(evidence);
      hitTarget.on("click", () => onSelect(c.id));
      const forecastItem = forecast.find((f) => f.corridorId === c.id);
      const forecastStr = forecastItem
        ? ` · Forecast: ~${forecastItem.estimate} cases next 30d`
        : "";
      hitTarget.bindTooltip(
        label(
          `${corridorName(c.id)} · ${rows.length} documented seizures${forecastStr}`,
        ),
        { sticky: true, className: "evidence-tooltip" },
      );
      const line = L.polyline(coordinates(c), {
        pane: "evidence",
        color:
          colorBy === "transport"
            ? transportSignals[c.mode].color
            : colorBy === "substance"
              ? "#438fff"
              : evidenceSignals[status],
        weight: c.id === selected ? 3.5 : 2,
        opacity: c.id === selected ? 1 : 0.7,
        dashArray: reviewPattern[status],
        className: "map-route",
      }).addTo(evidence);
      line.bindTooltip(
        label(
          `${corridorName(c.id)} · ${rows.length} documented seizures${forecastStr}`,
        ),
        { sticky: true, className: "evidence-tooltip" },
      );
      line.on("click", () => onSelect(c.id));
      const element = line.getElement();
      if (element) {
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute(
          "aria-label",
          `${corridorName(c.id)}, ${rows.length} documented seizures`,
        );
        element.setAttribute("data-corridor-id", c.id);
        element.setAttribute("data-transport-mode", c.mode);
        element.addEventListener("keydown", (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            event.preventDefault();
            onSelect(c.id);
          }
        });
      }
    }
    if (showPoints) {
      const filteredRecords =
        focusedDistrict && focusedDistrict !== "all"
          ? records.filter((r) => r.seizurePlace === focusedDistrict)
          : records;
      for (const r of filteredRecords) {
        const p = places.find((p) => p.id === r.seizurePlace);
        const lat = r.lat ?? p?.lat ?? 10.0;
        const lon = r.lon ?? p?.lon ?? 76.5;
        const subColor = substanceSignals[r.substance] ?? "#f59e0b";
        const markerColor =
          colorBy === "substance"
            ? subColor
            : colorBy === "transport"
              ? (r.transportMode &&
                 transportSignals[
                   r.transportMode.includes("rail") ||
                   r.transportMode.includes("train")
                     ? "Rail"
                     : "Road"
                 ]?.color) ??
                "#438fff"
              : evidenceSignals[r.status] ?? "#438fff";

        const pointMarker = L.circleMarker([lat, lon], {
          pane: "evidence",
          radius: r.quantity && r.unit === "kg" ? 5 : 3.5,
          color: markerColor,
          fillColor: markerColor,
          fillOpacity: 0.85,
          weight: 1.5,
        });

        const tooltipContent = `${r.placeName || r.seizurePlace} · ${r.specificDrug || r.substance}${r.quantityRaw ? ` (${r.quantityRaw})` : ""}`;
        pointMarker.bindTooltip(label(tooltipContent), {
          className: "evidence-tooltip",
        });

        pointMarker.on("click", () => {
          if (r.corridorId) onSelect(r.corridorId);
        });

        pointMarker.addTo(evidence);
      }
    }
    // District reference markers never imply an exact event location.
    for (const p of places) {
      const linked = corridors.find(
        (c) =>
          c.id === selected &&
          [c.origin, ...c.transit, c.destination].includes(p.id),
      );
      const marker = L.circleMarker([p.lat, p.lon], {
        pane: "evidence",
        radius: linked ? 4 : 2.5,
        color: linked ? "#eeeeee" : "#888888",
        weight: 1,
        fillColor: "#000",
        fillOpacity: 1,
      }).addTo(evidence);
      marker.bindTooltip(label(p.name.replace(" Urban", "")), {
        permanent: map.getZoom() < 10,
        direction: "right",
        offset: [7, 0],
        className: "district-label",
      });
      marker.on("click", () =>
        setChosen(
          locations.find((item) => item.referenceId === p.id) ?? {
            ...p,
            kind: "district reference",
          },
        ),
      );
    }
  }, [
    ready,
    records,
    selected,
    onSelect,
    forecast,
    showHypotheses,
    showPoints,
    view.zoom,
    colorBy,
    locations,
  ]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const { L, map } = e;
    e.locations.clearLayers();
    if (localPoints && view.zoom >= 11) {
      const bounds = map.getBounds();
      const visible = locations
        .filter(
          (p) =>
            !["district reference", "district"].includes(p.kind) &&
            bounds.contains([p.lat, p.lon]),
        )
        .slice(0, 800);
      for (const p of visible) {
        const marker = L.circleMarker([p.lat, p.lon], {
          radius: view.zoom >= 14 ? 2.5 : 1.5,
          color: "#b0b0b0",
          weight: 0,
          fillColor: "#b0b0b0",
          fillOpacity: 0.8,
        }).addTo(e.locations);
        marker.bindTooltip(
          label(`${p.name}${p.localName ? " / " + p.localName : ""}`),
          {
            permanent: view.zoom >= 14,
            direction: "right",
            className: "local-place-label",
          },
        );
        marker.on("click", () => setChosen(p));
      }
    }
    if (chosen?.bounds) {
      const [south, north, west, east] = chosen.bounds;
      L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        {
          color: "#e5e5e5",
          weight: 1,
          dashArray: "4 5",
          fill: false,
          interactive: false,
          className: "selected-feature-bounds",
        },
      ).addTo(e.locations);
    }
    if (chosen)
      L.circleMarker([chosen.lat, chosen.lon], {
        radius: 9,
        color: "#fff",
        weight: 1.5,
        fillOpacity: 0,
      })
        .bindTooltip(label(chosen.name), {
          permanent: true,
          direction: "top",
          className: "selected-place-label",
        })
        .addTo(e.locations);
  }, [ready, view, localPoints, locations, chosen]);
  useEffect(() => {
    const e = engine.current;
    if (!e || previousSelected.current === selected) return;
    previousSelected.current = selected;
    const c = corridors.find((c) => c.id === selected);
    if (c)
      e.map.fitBounds(
        [c.origin, ...c.transit, c.destination].map((id) => {
          const p = places.find((p) => p.id === id)!;
          return [p.lat, p.lon] as Leaflet.LatLngTuple;
        }),
        { padding: [70, 90], maxZoom: 10, animate: !reducedMotion() },
      );
  }, [ready, selected]);
  useEffect(() => {
    const e = engine.current;
    if (!e || previousDistrict.current === focusedDistrict) return;
    previousDistrict.current = focusedDistrict;
    const p = places.find((p) => p.id === focusedDistrict);
    if (p) e.map.setView([p.lat, p.lon], 10, { animate: !reducedMotion() });
    else
      e.map.fitBounds(KERALA, { padding: [32, 60], animate: !reducedMotion() });
  }, [ready, focusedDistrict]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  function locate(p: Location) {
    setChosen(p);
    onSearchTextChange(p.name);
    if (p.dataProvider === "openstreetmap" && p.state !== "Kerala")
      setFocusKerala(false);
    if (p.bounds) {
      const [south, north, west, east] = p.bounds;
      engine.current?.map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        {
          padding: [65, 80],
          maxZoom: p.kind === "road" ? 17 : 18,
          animate: !reducedMotion(),
        },
      );
      return;
    }
    engine.current?.map.setView(
      [p.lat, p.lon],
      ["district reference", "district"].includes(p.kind) ? 10 : 14,
      { animate: !reducedMotion() },
    );
  }
  function reset() {
    engine.current?.map.fitBounds(KERALA, {
      padding: [32, 60],
      animate: !reducedMotion(),
    });
    setChosen(null);
    onSearchTextChange("");
    setFocusKerala(true);
  }
  return (
    <div className={`map-stage detailed-map ${expanded ? "map-expanded" : ""}`}>
      <div
        ref={container}
        className="atlas leaflet-atlas"
        role="region"
        aria-label="Interactive street map of Kerala"
        tabIndex={0}
      />
      <div className="map-heading">
        <span>
          <Crosshair size={13} /> Kerala geographic workspace
        </span>
        <small>Street detail · evidence stays at district resolution</small>
      </div>
      <MapFeatureSearch
        places={locations}
        query={searchText}
        onQueryChange={onSearchTextChange}
        onSelect={locate}
        externalRequest={searchRequest}
      />
      {(mapError || (street && tileState === "unavailable")) && (
        <div className="map-error" role="status">
          {mapError ||
            "Some street tiles are unavailable. Bundled boundaries and fictional evidence remain visible."}
          <button
            onClick={() => {
              engine.current?.tiles.redraw();
              setTileState("loading");
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div className="map-controls">
        <button
          aria-label="Zoom in"
          title="Zoom in (+)"
          onClick={() => engine.current?.map.zoomIn()}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          title="Zoom out (−)"
          onClick={() => engine.current?.map.zoomOut()}
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Reset map view"
          title="Fit all of Kerala"
          onClick={reset}
        >
          <LocateFixed size={18} />
        </button>
        <button
          aria-label={expanded ? "Exit expanded map" : "Expand map"}
          title={expanded ? "Exit expanded map (Escape)" : "Expand map"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>
      </div>
      <details className="map-layer-menu">
        <summary>
          <Layers size={15} /> Layers
        </summary>
        <label>
          <input
            type="checkbox"
            checked={street}
            onChange={(e) => setStreet(e.target.checked)}
          />{" "}
          Street map <span>Online</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={districts}
            onChange={(e) => setDistricts(e.target.checked)}
          />{" "}
          District boundaries
        </label>
        <label>
          <input
            type="checkbox"
            checked={focusKerala}
            onChange={(e) => setFocusKerala(e.target.checked)}
          />{" "}
          Focus on Kerala
        </label>
        <label>
          <input
            type="checkbox"
            checked={localPoints}
            onChange={(e) => setLocalPoints(e.target.checked)}
          />{" "}
          Places & transport points
        </label>
        <small>
          Place points appear at zoom 11+; labels at 14+. Geographic context
          only.
        </small>
      </details>
      <div className="map-north">
        <Compass size={24} />
        <span>N</span>
      </div>
      <div className="map-legend logistics-legend">
        <label className="color-by-control">
          Color by{" "}
          <select
            aria-label="Color connections by"
            value={colorBy}
            onChange={(e) =>
              setColorBy(e.target.value as "substance" | "transport" | "evidence")
            }
          >
            <option value="substance">Substance category</option>
            <option value="transport">Transport mode</option>
            <option value="evidence">Evidence review</option>
          </select>
        </label>
        <div className="map-legend-signals">
          {colorBy === "substance"
            ? Object.entries(substanceSignals).map(([sub, color]) => (
                <span key={sub}>
                  <i
                    className="line"
                    style={{ borderColor: color, backgroundColor: color }}
                  />
                  {sub}
                </span>
              ))
            : colorBy === "transport"
              ? Object.entries(transportSignals)
                  .filter(([mode]) => corridors.some((c) => c.mode === mode))
                  .map(([mode, signal]) => (
                    <span key={mode}>
                      <i className="line" style={{ borderColor: signal.color }} />
                      {signal.label}
                    </span>
                  ))
              : Object.entries(evidenceSignals).map(([status, color]) => (
                  <span key={status}>
                    <i
                      className={`line ${status === "documented" ? "" : "dashed"}`}
                      style={{ borderColor: color }}
                    />
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                ))}
          {showHypotheses && (
            <span>
              <i className="line forecast-line" />
              Projected corridor flow
            </span>
          )}
          <button
            onClick={() => setShowPoints(!showPoints)}
            className={showPoints ? "on" : ""}
          >
            Seizure spots ({records.length})
          </button>
        </div>
        <small>
          1,137 verified public enforcement seizures across 14 Kerala districts.
        </small>
      </div>
      <div className="map-readout">
        <output
          aria-label="Map zoom level"
          data-zoom={view.zoom}
          aria-live="polite"
        >
          Z {view.zoom.toFixed(2)}
        </output>
        <span>
          {view.lat.toFixed(4)}° N / {view.lon.toFixed(4)}° E
        </span>
        <span className="map-gesture-hint">
          Scroll to zoom · drag to pan · double-click to zoom
        </span>
      </div>
      <div className="map-credit">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/opendatakerala/kl_district"
          target="_blank"
          rel="noreferrer"
        >
          Open Data Kerala
        </a>{" "}
        / ODbL ·{" "}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames / CC BY 4.0
        </a>{" "}
        · <span>Lines are schematic, not street journeys</span>
      </div>
      {chosen && (
        <PlaceProfile
          key={chosen.id}
          place={chosen}
          transport={transport}
          onLocate={locate}
          onClose={() => setChosen(null)}
        />
      )}
    </div>
  );
}
