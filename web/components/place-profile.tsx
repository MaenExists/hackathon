"use client";
import { useState, useMemo, useId } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  TrainFront,
  Plane,
  Anchor,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { nearestTransport, type PublicPlace } from "../lib/places";
const number = (value: number | null | undefined) =>
  value == null ? "Not reported" : value.toLocaleString("en-IN");
export default function PlaceProfile({
  place,
  transport,
  onClose,
  onLocate,
}: {
  place: PublicPlace;
  transport: PublicPlace[];
  onClose: () => void;
  onLocate: (place: PublicPlace) => void;
}) {
  const [tab, setTab] = useState<"overview" | "transport" | "sources">(
      "overview",
    ),
    [collapsed, setCollapsed] = useState(false),
    [full, setFull] = useState(false);
  const id = useId();
  const nearby = useMemo(
    () => nearestTransport(place, transport),
    [place, transport],
  );
  const sourced = Boolean(place.geonamesId);
  const osm = place.dataProvider === "openstreetmap";
  return (
    <section
      className={`map-location-info place-profile ${collapsed ? "profile-collapsed" : ""} ${full ? "profile-expanded" : ""}`}
      role="region"
      aria-label={`Place profile: ${place.name}`}
    >
      <header className="place-profile-head">
        <div>
          <span className="public-data-label">
            <MapPin size={11} />{" "}
            {osm ? "OpenStreetMap feature" : "Public geography"}
          </span>
          <h3>{place.name}</h3>
          {place.localName && <p lang="ml">{place.localName}</p>}
          <small>
            {[place.district, place.state ?? "India"]
              .filter(Boolean)
              .join(", ")}
          </small>
        </div>
        <button
          aria-label={
            full ? "Restore compact place profile" : "Expand place profile"
          }
          onClick={() => {
            setFull(!full);
            setCollapsed(false);
          }}
        >
          {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          aria-label={
            collapsed ? "Expand place details" : "Minimize place details"
          }
          onClick={() => {
            setCollapsed(!collapsed);
            setFull(false);
          }}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button aria-label="Dismiss selected place" onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      {!collapsed && (
        <>
          <div
            className="place-profile-tabs"
            role="tablist"
            aria-label="Place details"
          >
            {(["overview", "transport", "sources"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                id={`${id}-${t}`}
                aria-controls={`${id}-panel`}
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t === "overview"
                  ? "Overview"
                  : t === "transport"
                    ? "Nearby transport"
                    : "Sources"}
              </button>
            ))}
          </div>
          <div
            id={`${id}-panel`}
            className="place-profile-body"
            role="tabpanel"
            aria-labelledby={`${id}-${tab}`}
          >
            {tab === "overview" && osm && <MapFeatureOverview place={place} />}
            {tab === "overview" && !osm && (
              <>
                <div className="place-stat-grid">
                  <div>
                    <small>Reported population</small>
                    <strong>{number(place.population)}</strong>
                  </div>
                  <div>
                    <small>Elevation</small>
                    <strong>
                      {place.elevationM == null
                        ? "Not reported"
                        : `${number(place.elevationM)} m`}
                    </strong>
                    {place.elevationKind && <span>{place.elevationKind}</span>}
                  </div>
                </div>
                <p className="place-data-note">
                  Population reference year is not supplied by this gazetteer.
                  It is not a current population estimate.
                </p>
                <dl className="place-facts">
                  <div>
                    <dt>Feature</dt>
                    <dd>{place.featureLabel ?? place.kind}</dd>
                  </div>
                  <div>
                    <dt>District</dt>
                    <dd>{place.district ?? "Not reported"}</dd>
                  </div>
                  <div>
                    <dt>Subdistrict</dt>
                    <dd>{place.subdistrict ?? "Not reported"}</dd>
                  </div>
                  <div>
                    <dt>State / country</dt>
                    <dd>
                      {place.state ?? "Not reported"} /{" "}
                      {place.country ?? "India"}
                    </dd>
                  </div>
                  <div>
                    <dt>Time zone</dt>
                    <dd>{place.timezone ?? "Not reported"}</dd>
                  </div>
                  <div>
                    <dt>Coordinates</dt>
                    <dd className="coordinate-value">
                      {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
                    </dd>
                  </div>
                </dl>
                {Boolean(place.alternativeNames?.length) && (
                  <div className="place-aliases">
                    <h4>Other recorded names</h4>
                    <p>{place.alternativeNames!.slice(0, 6).join(" · ")}</p>
                  </div>
                )}
                <p className="place-data-note">
                  Representative geographic location, not an exact address or
                  event coordinate.
                </p>
              </>
            )}
            {tab === "transport" && (
              <>
                <p className="place-data-note">
                  Nearest features by type in the Kerala-only catalogue, within
                  120 km. Distances are straight-line, not travel distances.
                  Operating status and dataset completeness are unverified.
                </p>
                {nearby.length ? (
                  nearby.map((p) => (
                    <article
                      className={`nearby-place transport-${p.transportType === "Air facility" ? "air" : p.transportType?.startsWith("Rail") ? "rail" : "water"}`}
                      key={p.id}
                    >
                      <span className="transport-symbol">
                        {p.transportType === "Air facility" ? (
                          <Plane size={15} />
                        ) : p.transportType?.startsWith("Rail") ? (
                          <TrainFront size={15} />
                        ) : (
                          <Anchor size={15} />
                        )}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.transportType} · {p.distanceKm.toFixed(1)} km
                        </small>
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                          GeoNames source <ExternalLink size={9} />
                        </a>
                      </div>
                      <button
                        onClick={() => onLocate(p)}
                        aria-label={`Locate ${p.name}`}
                      >
                        Locate
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="place-empty">
                    No matching catalogued transport features within 120 km.
                    This does not establish an absence of infrastructure.
                  </p>
                )}
              </>
            )}
            {tab === "sources" && (
              <>
                <div className="source-provenance">
                  <h4>
                    {osm
                      ? "OpenStreetMap geographic feature"
                      : sourced
                        ? "GeoNames geographic record"
                        : "District reference point"}
                  </h4>
                  <p>
                    {osm
                      ? "This feature comes from Photon’s OpenStreetMap search index. The point and bounding extent locate the mapped feature; they do not reconstruct a journey. Missing fields remain unknown."
                      : sourced
                        ? "Fields are reproduced from the GeoNames India dump and administrative/feature-code tables. Unknown values remain unreported."
                        : "This representative district point belongs to the demonstration geography. No sourced population or elevation is attached."}
                  </p>
                  {place.sourceUrl && (
                    <a href={place.sourceUrl} target="_blank" rel="noreferrer">
                      {osm
                        ? "Open original OpenStreetMap feature"
                        : "Open original GeoNames record"}{" "}
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <dl className="place-facts">
                    <div>
                      <dt>Record ID</dt>
                      <dd>
                        {place.osmId
                          ? `${place.osmType} ${place.osmId}`
                          : (place.geonamesId ?? "Reference only")}
                      </dd>
                    </div>
                    <div>
                      <dt>Record modified</dt>
                      <dd>{place.sourceModified ?? "Not reported"}</dd>
                    </div>
                    <div>
                      <dt>Snapshot retrieved</dt>
                      <dd>{place.retrievedAt ?? "Not reported"}</dd>
                    </div>
                    <div>
                      <dt>Feature code</dt>
                      <dd>{place.featureCode ?? "Not reported"}</dd>
                    </div>
                  </dl>
                  <p className="place-data-note">
                    {osm
                      ? "Search results depend on the OpenStreetMap index and can be incomplete or outdated. Retrieval time is not a feature modification date. The selection box is the source extent, not road or route geometry."
                      : "The record modification date does not date every individual field. GeoNames data can be incomplete or outdated. DEM elevation is modelled terrain, not a survey."}
                  </p>
                  <a
                    href={
                      osm
                        ? "https://www.openstreetmap.org/copyright"
                        : "https://www.geonames.org/"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {osm ? "OpenStreetMap contributors" : "GeoNames"}
                  </a>{" "}
                  ·{" "}
                  <a
                    href={
                      osm
                        ? "https://opendatacommons.org/licenses/odbl/1-0/"
                        : "https://creativecommons.org/licenses/by/4.0/"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {osm ? "ODbL 1.0" : "CC BY 4.0"}
                  </a>
                </div>
              </>
            )}
          </div>
          <footer className="place-profile-footer">
            Geographic context · real public data · separate from fictional
            evidence
          </footer>
        </>
      )}
    </section>
  );
}

function MapFeatureOverview({ place }: { place: PublicPlace }) {
  const addressLabels: Record<string, string> = {
    housenumber: "House number",
    street: "Street",
    district: "Suburb / district",
    city: "City / town",
    county: "County / area",
    state: "State",
    postcode: "Postcode",
    country: "Country",
  };
  return (
    <>
      <div className="map-feature-kind">
        {place.kind === "road"
          ? "Mapped road"
          : (place.featureLabel ?? "Mapped feature")}
      </div>
      {place.displayAddress && (
        <p className="map-feature-address">{place.displayAddress}</p>
      )}
      <dl className="place-facts">
        <div>
          <dt>Feature</dt>
          <dd>{place.featureLabel ?? place.kind}</dd>
        </div>
        {Object.entries(place.address ?? {}).map(([key, value]) => (
          <div key={key}>
            <dt>{addressLabels[key] ?? key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Coordinates</dt>
          <dd className="coordinate-value">
            {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
          </dd>
        </div>
        <div>
          <dt>OSM category</dt>
          <dd>{place.sourceCategory ?? "Not reported"}</dd>
        </div>
      </dl>
      {place.sourceUrl && (
        <a
          className="map-feature-source"
          href={place.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          View mapped feature <ExternalLink size={11} />
        </a>
      )}
      <p className="place-data-note">
        OpenStreetMap source point{place.bounds ? " and mapped extent" : ""}. No
        case evidence is inferred from this result.
      </p>
    </>
  );
}
