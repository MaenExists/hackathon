"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Compass,
  Search,
  Maximize,
  Minimize,
  X,
  Crosshair,
} from "lucide-react";
import type * as Leaflet from "leaflet";
import type { GeoJsonObject } from "geojson";
import { places, corridors, corridorName } from "../data/geography";
import type { CaseRecord, ForecastRow } from "../lib/types";

type Location = {
  id: string;
  name: string;
  localName?: string;
  aliases?: string;
  kind: string;
  lat: number;
  lon: number;
};
type Engine = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  boundaries: Leaflet.LayerGroup;
  evidence: Leaflet.LayerGroup;
  locations: Leaflet.LayerGroup;
  tiles: Leaflet.TileLayer;
};
const KERALA: Leaflet.LatLngBoundsLiteral = [
  [8.15, 74.75],
  [12.85, 77.6],
];
const SIGNALS = {
  documented: "#438fff",
  unreviewed: "#ffd000",
  disputed: "#ff4545",
};
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
}: {
  records: CaseRecord[];
  selected: string;
  onSelect: (id: string) => void;
  forecast: ForecastRow[];
  showHypotheses: boolean;
  showPoints: boolean;
  setShowPoints: (x: boolean) => void;
  focusedDistrict?: string;
}) {
  const container = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [tileState, setTileState] = useState("loading");
  const [street, setStreet] = useState(true),
    [districts, setDistricts] = useState(true),
    [localPoints, setLocalPoints] = useState(true),
    [expanded, setExpanded] = useState(false);
  const [locations, setLocations] = useState<Location[]>(fallbackLocations),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [chosen, setChosen] = useState<Location | null>(null);
  const [view, setView] = useState({ zoom: 7, lat: 10.5, lon: 76.3, tick: 0 });
  const previousSelected = useRef(selected),
    previousDistrict = useRef(focusedDistrict);
  const searchResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    return locations
      .filter((p) =>
        `${p.name} ${p.localName ?? ""} ${p.aliases ?? ""}`
          .toLocaleLowerCase()
          .includes(term),
      )
      .sort(
        (a, b) =>
          Number(!a.name.toLocaleLowerCase().startsWith(term)) -
            Number(!b.name.toLocaleLowerCase().startsWith(term)) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 7);
  }, [query, locations]);
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
          minZoom: 6,
          maxZoom: 19,
          maxBounds: [
            [5, 70],
            [19, 84],
          ],
          maxBoundsViscosity: 0.6,
          zoomAnimation: !reducedMotion(),
          fadeAnimation: !reducedMotion(),
        });
        map.fitBounds(KERALA, { padding: [32, 60], animate: false });
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
        };
        observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(container.current);
        setReady(true);
        const geographic = await Promise.allSettled(
          ["/data/land.geojson", "/data/kerala.geojson"].map((url) =>
            fetch(url).then((r) => {
              if (!r.ok) throw Error();
              return r.json() as Promise<GeoJsonObject>;
            }),
          ),
        );
        if (cancelled) return;
        for (let i = 0; i < geographic.length; i++) {
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
        return r.json() as Promise<{ places: Location[] }>;
      })
      .then((data) => {
        if (!cancelled) setLocations([...fallbackLocations, ...data.places]);
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
      for (const f of forecast.slice(0, 3)) {
        const c = corridors.find((c) => c.id === f.corridorId)!;
        L.polyline(coordinates(c), {
          pane: "evidence",
          color: SIGNALS.unreviewed,
          weight: 8,
          opacity: 0.65,
          dashArray: "2 12",
          interactive: false,
        }).addTo(evidence);
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
      hitTarget.bindTooltip(
        label(
          `${corridorName(c.id)} · district precision · fictional evidence`,
        ),
        { sticky: true, className: "evidence-tooltip" },
      );
      const line = L.polyline(coordinates(c), {
        pane: "evidence",
        color: SIGNALS[status],
        weight: c.id === selected ? 3 : 1.5,
        opacity: c.id === selected ? 1 : 0.6,
        dashArray: status === "documented" ? undefined : "7 6",
        className: "map-route",
      }).addTo(evidence);
      line.bindTooltip(
        label(
          `${corridorName(c.id)} · ${rows.length} fictional records · district precision`,
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
          `${corridorName(c.id)}, ${rows.length} synthetic records`,
        );
        element.setAttribute("data-corridor-id", c.id);
        element.addEventListener("keydown", (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            event.preventDefault();
            onSelect(c.id);
          }
        });
      }
    }
    if (showPoints)
      for (const r of records.filter((r) => !r.corridorId)) {
        const p = places.find((p) => p.id === r.seizurePlace)!;
        L.circleMarker([p.lat, p.lon], {
          pane: "evidence",
          radius: 4,
          color: SIGNALS.unreviewed,
          fillColor: "#000",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(
            label(`${r.id} · fictional seizure only · movement unknown`),
            { className: "evidence-tooltip" },
          )
          .addTo(evidence);
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
      marker.bindPopup(
        label(
          `${p.name}: representative district location, not a seizure coordinate.`,
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
            p.kind !== "district reference" && bounds.contains([p.lat, p.lon]),
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
    setQuery(p.name);
    setSearchOpen(false);
    engine.current?.map.setView(
      [p.lat, p.lon],
      p.kind === "district reference" ? 10 : 14,
      { animate: !reducedMotion() },
    );
  }
  function reset() {
    engine.current?.map.fitBounds(KERALA, {
      padding: [32, 60],
      animate: !reducedMotion(),
    });
    setChosen(null);
    setQuery("");
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
      <div className="map-search">
        <div className="map-search-field">
          <Search size={15} />
          <input
            aria-label="Find a Kerala place"
            placeholder="Find a town, village or district"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && searchResults[0]) {
                e.preventDefault();
                locate(searchResults[0]);
              }
            }}
          />
          {query && (
            <button
              aria-label="Clear place search"
              onClick={() => {
                setQuery("");
                setSearchOpen(false);
                setChosen(null);
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {searchOpen && query.trim() && (
          <div className="map-search-results">
            {searchResults.map((p) => (
              <button key={p.id} onClick={() => locate(p)}>
                <span>
                  {p.name}
                  <small>{p.localName || p.kind}</small>
                </span>
                <span>
                  {p.kind === "district reference" ? "District" : "Locate"}
                </span>
              </button>
            ))}
            {!searchResults.length && (
              <p>
                No matching bundled place. Browse the street map or try a
                district name.
              </p>
            )}
          </div>
        )}
      </div>
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
            checked={localPoints}
            onChange={(e) => setLocalPoints(e.target.checked)}
          />{" "}
          Local place points
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
      <div className="map-legend">
        <span>
          <i className="line documented-line" />
          Documented
        </span>
        <span>
          <i className="line unreviewed-line dashed" />
          Unreviewed
        </span>
        <span>
          <i className="line disputed-line dashed" />
          Disputed
        </span>
        {showHypotheses && (
          <span>
            <i className="line hypothesis-line dashed" />
            Hypothesis
          </span>
        )}
        <button
          onClick={() => setShowPoints(!showPoints)}
          className={showPoints ? "on" : ""}
        >
          <Layers size={13} /> Seizure only
        </button>
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
        <div className="map-location-info">
          <span>
            {chosen.name}{" "}
            <small>
              {chosen.lat.toFixed(5)}, {chosen.lon.toFixed(5)} · Geographic
              context
            </small>
          </span>
          <button
            aria-label="Dismiss selected place"
            onClick={() => setChosen(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
