"use client";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useId,
} from "react";
import { Search, X, LoaderCircle, ArrowUpRight } from "lucide-react";
import { searchPlaces, type PublicPlace } from "../lib/places";
import type {
  MapSearchResponse,
  SearchScope,
  SearchCategory,
} from "../lib/map-search";
export default function MapFeatureSearch({
  places,
  query,
  onQueryChange,
  onSelect,
  externalRequest,
}: {
  places: PublicPlace[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (place: PublicPlace) => void;
  externalRequest: number;
}) {
  const [scope, setScope] = useState<SearchScope>("kerala"),
    [category, setCategory] = useState<SearchCategory>("all");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [active, setActive] = useState(-1);
  const [online, setOnline] = useState<
    (MapSearchResponse & { query: string }) | null
  >(null);
  const request = useRef<AbortController | null>(null),
    serial = useRef(0),
    handled = useRef(externalRequest);
  const id = useId();
  const local = useMemo(
    () =>
      category === "all" || category === "places"
        ? searchPlaces(places, query)
        : [],
    [places, query, category],
  );
  const current =
    online?.query === query.trim() &&
    online.scope === scope &&
    online.category === category
      ? online
      : null;
  const results = [...(current?.results ?? []), ...local];
  useEffect(() => {
    request.current?.abort();
    serial.current++;
    setBusy(false);
    setError("");
    setActive(-1);
  }, [query, scope, category]);
  useEffect(() => () => request.current?.abort(), []);
  const submit = useCallback(async () => {
    const q = query.trim();
    setOpen(true);
    setActive(-1);
    if (q.length < 2) {
      setError("Enter at least two characters.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const ticket = ++serial.current;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ q, scope, category });
      const response = await fetch(`/api/map-search?${params}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = (await response.json()) as MapSearchResponse & {
        error?: string;
      };
      if (!response.ok)
        throw Error(
          payload.error ?? "Online map search is unavailable. Try again.",
        );
      if (ticket === serial.current) setOnline({ ...payload, query: q });
    } catch (e) {
      if (!controller.signal.aborted && ticket === serial.current)
        setError((e as Error).message);
    } finally {
      if (ticket === serial.current) setBusy(false);
    }
  }, [query, scope, category]);
  useEffect(() => {
    if (externalRequest === handled.current) return;
    handled.current = externalRequest;
    submit();
  }, [externalRequest, submit]);
  function choose(place: PublicPlace) {
    setOpen(false);
    setActive(-1);
    onSelect(place);
  }
  return (
    <div className="map-search universal-map-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="map-search-field">
          <Search size={15} />
          <input
            aria-label="Find a Kerala place"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && Boolean(query.trim())}
            aria-controls={`${id}-results`}
            aria-activedescendant={
              active >= 0 ? `${id}-option-${active}` : undefined
            }
            placeholder="Road, address, landmark or destination"
            value={query}
            maxLength={180}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                setActive(-1);
              }
              if (e.key === "ArrowDown" && results.length) {
                e.preventDefault();
                setOpen(true);
                setActive((i) => (i + 1) % results.length);
              }
              if (e.key === "ArrowUp" && results.length) {
                e.preventDefault();
                setActive((i) => (i - 1 + results.length) % results.length);
              }
              if (e.key === "Enter" && active >= 0 && results[active]) {
                e.preventDefault();
                choose(results[active]);
              }
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear place search"
              onClick={() => {
                onQueryChange("");
                setOpen(false);
              }}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="submit"
            className="online-map-search-button"
            aria-label="Search OpenStreetMap"
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={15} className="search-spinner" />
            ) : (
              <ArrowUpRight size={15} />
            )}
          </button>
        </div>
        <div className="map-search-options">
          <select
            aria-label="Map search area"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as SearchScope);
              setOpen(true);
            }}
          >
            <option value="kerala">Kerala</option>
            <option value="india">India</option>
          </select>
          <select
            aria-label="Map search feature type"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as SearchCategory);
              setOpen(true);
            }}
          >
            <option value="all">All map features</option>
            <option value="roads">Roads</option>
            <option value="addresses">Addresses & buildings</option>
            <option value="places">Cities & localities</option>
          </select>
        </div>
      </form>
      {open && query.trim() && (
        <div
          className="map-search-results"
          id={`${id}-results`}
          role="listbox"
          aria-label="Map search results"
        >
          {busy && <p role="status">Searching OpenStreetMap features…</p>}
          {error && (
            <p className="map-search-error" role="status">
              {error} Bundled suggestions remain available.
            </p>
          )}
          {current && (
            <div className="search-result-heading">
              OpenStreetMap results{" "}
              <span>
                {current.cached ? "Cached" : "Online"} ·{" "}
                {current.results.length}
              </span>
            </div>
          )}
          {current?.results.map((p, i) => (
            <button
              type="button"
              key={p.id}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={active === i}
              onClick={() => choose(p)}
            >
              <span>
                {p.name}
                <small>
                  {p.featureLabel} · {p.displayAddress ?? p.state}
                </small>
              </span>
              <span>{p.kind === "road" ? "Road" : "Map"}</span>
            </button>
          ))}
          {current && !current.results.length && !busy && (
            <p>
              No indexed matches. Try the full road name, a postcode or the
              nearest town.
            </p>
          )}
          {Boolean(local.length) && (
            <div className="search-result-heading">
              Bundled place profiles <span>Offline</span>
            </div>
          )}
          {local.map((p, i) => {
            const index = (current?.results.length ?? 0) + i;
            return (
              <button
                type="button"
                key={p.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={active === index}
                onClick={() => choose(p)}
              >
                <span>
                  {p.name}
                  <small>
                    {[
                      p.localName,
                      p.district,
                      p.transportType ?? p.featureLabel ?? p.kind,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span>Profile</span>
              </button>
            );
          })}
          {!current && !busy && !error && (
            <p>
              Press Enter or click ↗ to search mapped roads, addresses, shops,
              stations and landmarks.
            </p>
          )}
          <footer>
            <a
              href="https://photon.komoot.io/"
              target="_blank"
              rel="noreferrer"
            >
              Photon
            </a>{" "}
            /{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>
            . Results depend on the public map index.
          </footer>
        </div>
      )}
    </div>
  );
}
