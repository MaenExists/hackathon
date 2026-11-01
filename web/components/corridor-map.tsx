"use client";
import { useEffect, useState, useRef } from "react";
import { Plus, Minus, LocateFixed, Layers, Compass } from "lucide-react";
import { places, corridors, placeName, corridorName } from "../data/geography";
import type { CaseRecord, ForecastRow } from "../lib/types";
type Feature = {
  properties: { name: string };
  geometry: { type: string; coordinates: number[][][][] };
};
const project = (lon: number, lat: number): [number, number] => [
  (lon - 73.5) * 137,
  (14.0 - lat) * 137,
];
const shape = (f: Feature) =>
  f.geometry.coordinates
    .map((poly) =>
      poly
        .map(
          (ring) =>
            ring
              .map((p, i) => `${i ? "L" : "M"}${project(p[0], p[1]).join(",")}`)
              .join(" ") + " Z",
        )
        .join(" "),
    )
    .join(" ");
export default function CorridorMap({
  records,
  selected,
  onSelect,
  forecast,
  showHypotheses,
  showPoints,
  setShowPoints,
}: {
  records: CaseRecord[];
  selected: string;
  onSelect: (id: string) => void;
  forecast: ForecastRow[];
  showHypotheses: boolean;
  showPoints: boolean;
  setShowPoints: (x: boolean) => void;
}) {
  const [districts, setDistricts] = useState<Feature[]>([]),
    [land, setLand] = useState<Feature[]>([]),
    [mapError, setMapError] = useState(false);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const [narrow, setNarrow] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const resize = () => setNarrow(media.matches);
    resize();
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    Promise.all(
      ["/data/kerala.geojson", "/data/land.geojson"].map((url) =>
        fetch(url).then((r) => {
          if (!r.ok) throw Error();
          return r.json() as Promise<{ features: Feature[] }>;
        }),
      ),
    )
      .then(([a, b]) => {
        setDistricts(a.features);
        setLand(b.features);
      })
      .catch(() => setMapError(true));
  }, []);
  const active = corridors.filter((c) =>
    records.some((r) => r.corridorId === c.id),
  );
  const visiblePlaces = new Set(
    active.flatMap((c) => [c.origin, ...c.transit, c.destination]),
  );
  const path = (c: (typeof corridors)[number]) =>
    [c.origin, ...c.transit, c.destination]
      .map((id, i) => {
        const p = places.find((p) => p.id === id)!;
        const [x, y] = project(p.lon, p.lat);
        return `${i ? "L" : "M"}${x},${y}`;
      })
      .join(" ");
  return (
    <div className="map-stage">
      <div className="map-heading">
        <span>
          <span className="signal-dot" /> Kerala & connecting districts
        </span>
        <small>District resolution · schematic connections</small>
      </div>
      {mapError && (
        <div className="map-error">
          Boundary assets could not load. Connections remain available; reload
          to restore geographic context.
        </div>
      )}
      <svg
        className="atlas"
        viewBox={narrow ? "180 0 600 830" : "0 0 900 830"}
        aria-label="Interactive district corridor map of Kerala and neighbouring states"
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-feature]")) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            setPan({
              x:
                drag.current.px +
                ((e.clientX - drag.current.x) * 900) / rect.width,
              y:
                drag.current.py +
                ((e.clientY - drag.current.y) * 830) / rect.height,
            });
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <pattern
            id="grid"
            width="68.5"
            height="68.5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M68.5 0H0V68.5"
              fill="none"
              stroke="#294255"
              strokeWidth=".5"
              opacity=".45"
            />
          </pattern>
          <filter id="route-glow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <rect width="900" height="830" fill="#101e2c" />
        <rect width="900" height="830" fill="url(#grid)" />
        <g
          transform={`translate(${450 + pan.x} ${415 + pan.y}) scale(${zoom}) translate(-450 -415)`}
        >
          {land.map((f, i) => (
            <path
              key={i}
              d={shape(f)}
              fill="#1c2d3d"
              stroke="#32495a"
              strokeWidth="1"
            />
          ))}
          {districts.map((f, i) => (
            <path
              key={i}
              d={shape(f)}
              fill="#243e4c"
              fillOpacity=".7"
              stroke="#43606a"
              strokeWidth=".8"
            >
              <title>{f.properties.name} · geographic context only</title>
            </path>
          ))}
          <text x="450" y="115" className="state-label">
            Karnataka
          </text>
          <text
            x="690"
            y="550"
            className="state-label"
            transform="rotate(-55 690 550)"
          >
            Tamil Nadu
          </text>
          <text
            x="365"
            y="580"
            className="kerala-label"
            transform="rotate(54 365 580)"
          >
            Kerala
          </text>
          <text
            x="115"
            y="545"
            className="sea-label"
            transform="rotate(-17 115 545)"
          >
            Arabian Sea
          </text>
          {showHypotheses &&
            forecast.slice(0, 3).map((row) => {
              const c = corridors.find((c) => c.id === row.corridorId)!;
              return (
                <path
                  key={`f${c.id}`}
                  d={path(c)}
                  fill="none"
                  stroke="#efbd73"
                  strokeWidth="9"
                  strokeDasharray="2 13"
                  opacity=".65"
                />
              );
            })}
          {active.map((c) => {
            const rows = records.filter((r) => r.corridorId === c.id),
              documented = rows.some((r) => r.status === "documented"),
              color =
                c.id === selected
                  ? "#8ae7d0"
                  : documented
                    ? "#62a8c8"
                    : "#b19c7d";
            return (
              <g
                key={c.id}
                data-feature="route"
                role="button"
                tabIndex={0}
                aria-label={`${corridorName(c.id)}, ${rows.length} synthetic records`}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(c.id);
                  }
                }}
                className="map-route"
              >
                {c.id === selected && (
                  <path
                    d={path(c)}
                    stroke={color}
                    strokeWidth="12"
                    opacity=".25"
                    filter="url(#route-glow)"
                    fill="none"
                  />
                )}
                <path
                  d={path(c)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />
                <path
                  d={path(c)}
                  fill="none"
                  stroke={color}
                  strokeWidth={c.id === selected ? 3.5 : 1.8}
                  opacity={c.id === selected ? 1 : 0.53}
                  strokeDasharray={documented ? undefined : "6 6"}
                  strokeLinejoin="round"
                />
                <title>
                  {corridorName(c.id)} · {rows.length} fictional source records
                </title>
              </g>
            );
          })}
          {showPoints &&
            records
              .filter((r) => !r.corridorId)
              .map((r) => {
                const p = places.find((p) => p.id === r.seizurePlace)!;
                const [x, y] = project(p.lon, p.lat);
                return (
                  <rect
                    key={r.id}
                    x={x - 4}
                    y={y - 4}
                    width="8"
                    height="8"
                    fill="#c7a4d8"
                    transform={`rotate(45 ${x} ${y})`}
                  >
                    <title>{r.id}: seizure only, movement unknown</title>
                  </rect>
                );
              })}
          {places
            .filter((p) => visiblePlaces.has(p.id))
            .map((p) => {
              const [x, y] = project(p.lon, p.lat),
                highlight =
                  selected &&
                  corridors.some(
                    (c) =>
                      c.id === selected &&
                      [c.origin, ...c.transit, c.destination].includes(p.id),
                  );
              return (
                <g key={p.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={highlight ? 6 : 4}
                    fill={highlight ? "#9cecd8" : "#7097ad"}
                    stroke="#132335"
                    strokeWidth="2"
                  />
                  <text
                    x={x + 11}
                    y={y + 4}
                    className={`place-label ${highlight ? "bright" : ""}`}
                  >
                    {p.name.replace(" Urban", "")}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
      <div className="map-controls">
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.65))}
        >
          <Minus size={18} />
        </button>
        <button
          aria-label="Reset map view"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <LocateFixed size={18} />
        </button>
      </div>
      <div className="map-north">
        <Compass size={26} />
        <span>N</span>
      </div>
      <div className="map-legend">
        <span>
          <i className="line teal" />
          Documented
        </span>
        <span>
          <i className="line dashed" />
          Unreviewed / disputed
        </span>
        {showHypotheses && (
          <span>
            <i className="line amber dashed" />
            Model hypothesis
          </span>
        )}
        <button
          onClick={() => setShowPoints(!showPoints)}
          className={showPoints ? "on" : ""}
        >
          <Layers size={13} /> Seizure-only points
        </button>
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
        /{" "}
        <a
          href="https://github.com/opendatakerala/kl_district"
          target="_blank"
          rel="noreferrer"
        >
          Open Data Kerala
        </a>
        , ODbL · Natural Earth · <span>Not a street-level route</span>
      </div>
    </div>
  );
}
