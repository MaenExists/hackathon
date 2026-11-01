"use client";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Activity,
  Map,
  ChartNoAxesCombined,
  Files,
  MessageSquare,
  FileText,
  BookOpen,
  ChevronRight,
  ArrowUpRight,
  Search,
  Download,
  Upload,
  ShieldCheck,
  Clock,
  Check,
  Info,
  X,
  Play,
  Pause,
  Route,
  SlidersHorizontal,
  ArrowRight,
  ExternalLink,
  Network,
  PanelLeftClose,
  Plus,
  RefreshCw,
} from "lucide-react";
import CorridorMap from "./corridor-map";
import TipForm from "./tip-form";
import ModelLab from "./model-lab";
import { places, corridors, corridorName, placeName } from "../data/geography";
import type {
  CaseRecord,
  ForecastRow,
  Fold,
  Review,
  Tip,
  Role,
} from "../lib/types";
type Brief = {
  id: string;
  title: string;
  audience: string;
  content: string;
  createdAt: string;
};
type Data = {
  user: { displayName: string; role: Role };
  records: CaseRecord[];
  reviews: Review[];
  tips: Tip[];
  forecast: ForecastRow[];
  evaluation: Fold[];
  limitations: string[];
  aggregates: { corridorId: string; count: number; reviewed: number | null }[];
  briefs: Brief[];
  asOf: string;
};
type Tab = "map" | "forecast" | "records" | "tips" | "briefs" | "sources";
const nav = [
  { id: "map", name: "Corridor atlas", icon: Map },
  { id: "forecast", name: "Forecast lab", icon: ChartNoAxesCombined },
  { id: "records", name: "Evidence library", icon: Files },
  { id: "tips", name: "Community leads", icon: MessageSquare },
  { id: "briefs", name: "Planning briefs", icon: FileText },
  { id: "sources", name: "Sources & methods", icon: BookOpen },
] as const;
async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const j = (await r.json()) as T & { error?: string };
  if (!r.ok) throw Error(j.error || "Request failed. Try again.");
  return j;
}
function download(name: string, content: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      {status === "documented" ? (
        <ShieldCheck size={11} />
      ) : (
        <Clock size={11} />
      )}{" "}
      {status === "documented"
        ? "Documented"
        : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
function Modal({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span
      className="mini-bars"
      aria-label={`Monthly counts: ${values.join(", ")}`}
    >
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max((v / max) * 30, 2)}px` }} />
      ))}
    </span>
  );
}
export default function Workspace() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState<Tab>("map"),
    [selected, setSelected] = useState("c01");
  const [mapQuery, setMapQuery] = useState(""),
    [mapSearchRequest, setMapSearchRequest] = useState(0);
  const [forecastView, setForecastView] = useState<"trained" | "original">(
    "trained",
  );
  const [search, setSearch] = useState(""),
    [substance, setSubstance] = useState("all"),
    [status, setStatus] = useState("all"),
    [district, setDistrict] = useState("all"),
    [source, setSource] = useState("all"),
    [period, setPeriod] = useState("2026-08-03"),
    [month, setMonth] = useState(10),
    [playing, setPlaying] = useState(false),
    [hypotheses, setHypotheses] = useState(false),
    [points, setPoints] = useState(true);
  const [record, setRecord] = useState<CaseRecord | null>(null),
    [showImport, setShowImport] = useState(false),
    [showTip, setShowTip] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [tour, setTour] = useState<number | null>(null);
  const [page, setPage] = useState(0),
    [reviewNote, setReviewNote] = useState(""),
    [reviewStatus, setReviewStatus] = useState("disputed"),
    [evidenceId, setEvidenceId] = useState(""),
    [independent, setIndependent] = useState(false),
    [tip, setTip] = useState<Tip | null>(null),
    [audience, setAudience] = useState("prevention"),
    [briefTitle, setBriefTitle] = useState(
      "Kerala corridor review · November 2026",
    ),
    [briefNote, setBriefNote] = useState(""),
    [activeBrief, setActiveBrief] = useState<Brief | null>(null);
  const importRef = useRef<HTMLInputElement>(null),
    searchRef = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      setError("");
      setData(await api<Data>("workspace"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setMonth((m) => {
          if (m >= 10) {
            setPlaying(false);
            return 10;
          }
          return m + 1;
        }),
      1100,
    );
    return () => clearInterval(t);
  }, [playing]);
  const analyst = data?.user.role === "analyst";
  const filtered = useMemo(
    () =>
      data?.records.filter((r) => {
        const c = corridors.find((c) => c.id === r.corridorId),
          geo = c
            ? [c.origin, ...c.transit, c.destination, r.seizurePlace]
            : [r.seizurePlace];
        const q = search.toLowerCase();
        return (
          r.eventDate >= period &&
          r.eventDate <= `2026-${String(month).padStart(2, "0")}-31` &&
          r.availableDate <= data.asOf &&
          (substance === "all" || r.substance === substance) &&
          (status === "all" || r.status === status) &&
          (source === "all" ||
            (source === "movement") === Boolean(r.corridorId)) &&
          (district === "all" || geo.includes(district)) &&
          (!q ||
            `${r.id} ${corridorName(r.corridorId ?? "")} ${r.substance} ${r.source}`
              .toLowerCase()
              .includes(q))
        );
      }) ?? [],
    [data, period, month, substance, status, district, source, search],
  );
  const activeCorridors = corridors.filter((c) =>
    filtered.some((r) => r.corridorId === c.id),
  );
  const selectedCorridor = corridors.find((c) => c.id === selected)!;
  const corridorRecords = filtered
    .filter((r) => r.corridorId === selected)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const chart = Array.from(
    { length: 10 },
    (_, i) =>
      data?.records.filter(
        (r) =>
          r.eventDate.startsWith(`2026-${String(i + 1).padStart(2, "0")}`) &&
          r.availableDate <= data.asOf &&
          (substance === "all" || r.substance === substance) &&
          (status === "all" || r.status === status) &&
          (source === "all" ||
            (source === "movement") === Boolean(r.corridorId)) &&
          (district === "all" ||
            [
              r.seizurePlace,
              ...(corridors.find((c) => c.id === r.corridorId)
                ? [
                    corridors.find((c) => c.id === r.corridorId)!.origin,
                    ...corridors.find((c) => c.id === r.corridorId)!.transit,
                    corridors.find((c) => c.id === r.corridorId)!.destination,
                  ]
                : []),
            ].includes(district)) &&
          (!search ||
            `${r.id} ${corridorName(r.corridorId ?? "")} ${r.substance} ${r.source}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ).length ?? 0,
  );
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(entityType: "case" | "tip", entityId: string) {
    await act(async () => {
      await api("reviews", {
        entityType,
        entityId,
        status: reviewStatus,
        note: reviewNote,
        evidenceId: evidenceId || null,
        independent,
      });
      await load();
      setRecord(null);
      setTip(null);
      setToast("Review saved with an auditable evidence trail.");
    });
  }
  function openRecord(r: CaseRecord) {
    setRecord(r);
    setReviewStatus(r.status === "documented" ? "disputed" : "documented");
    setReviewNote("");
    setEvidenceId("");
    setIndependent(false);
  }
  function openTip(t: Tip) {
    setTip(t);
    setReviewStatus("triaged");
    setReviewNote("");
    setEvidenceId("");
    setIndependent(false);
  }
  function go(id: Tab) {
    setTab(id);
    setPage(0);
  }
  function startTour() {
    setTour(0);
    setTab("map");
    setPeriod("2026-08-03");
    setMonth(10);
    setSelected("c01");
    setSearch("");
    setStatus("all");
    setDistrict("all");
    setSubstance("all");
  }
  function nextTour() {
    const n = (tour ?? 0) + 1;
    if (n >= 5) {
      setTour(null);
      setToast(
        "Walkthrough complete. Explore, review and build your own brief.",
      );
      return;
    }
    setTour(n);
    setTab((["map", "records", "forecast", "tips", "briefs"] as Tab[])[n]);
  }
  if (!data)
    return (
      <main className="loading-screen">
        <div className="brand-symbol">
          <Network size={34} />
        </div>
        <h1>
          Corridor<span>Kerala intelligence lab</span>
        </h1>
        <p>{error || "Opening the geographic workspace…"}</p>
        {error && (
          <>
            <a
              className="button primary"
              href="/signin-with-chatgpt?return_to=/"
              target="_top"
            >
              Sign in to the private demo <ArrowRight size={16} />
            </a>
            <button onClick={load}>Try again</button>
            <a href="/report">Open the fictional tip exercise</a>
          </>
        )}
        <small>
          Independent hackathon prototype. Synthetic records. No agency
          affiliation.
        </small>
      </main>
    );
  const mean = (key: "modelMae" | "baselineMae") =>
    data.evaluation.reduce((s, f) => s + f[key], 0) / data.evaluation.length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Network size={25} />
          </span>
          <span>
            corridor<span className="brand-sub">Kerala intelligence lab</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="signal-dot" /> Demonstration workspace
        </div>
        <nav aria-label="Main navigation">
          {nav
            .filter(
              (n) => analyst || !["records", "tips", "map"].includes(n.id),
            )
            .map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={tab === n.id ? "active" : ""}
              >
                <n.icon size={18} />
                <span>{n.name}</span>
                {n.id === "tips" && (
                  <span className="nav-count">
                    {data.tips.filter((t) => t.status === "unreviewed").length}
                  </span>
                )}
                {tab === n.id && (
                  <ChevronRight className="nav-arrow" size={14} />
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="tour-launch"
            onClick={startTour}
            disabled={!analyst}
          >
            <Play size={16} />
            <span>
              Take the guided demo<small>A five-stop evidence journey</small>
            </span>
          </button>
          <div className="prototype-note">
            <ShieldCheck size={17} />
            <p>
              Independent research prototype
              <span>No agency access or affiliation</span>
            </p>
          </div>
          <div className="profile">
            <span className="avatar">
              {data.user.displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>
                {analyst ? "District analyst" : "Service planner"}
              </strong>
              <small>
                Demo role ·{" "}
                <button
                  onClick={() =>
                    act(async () => {
                      await api("session", {
                        role: analyst ? "planner" : "analyst",
                      });
                      await load();
                      setTab(analyst ? "forecast" : "map");
                      setRecord(null);
                      setTip(null);
                      setAudience("prevention");
                    })
                  }
                >
                  Switch role
                </button>
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <ChevronRight size={13} />{" "}
            <strong>{nav.find((n) => n.id === tab)?.name}</strong>
          </div>
          <div className="header-right">
            <span className="demo-pill">
              <span /> Synthetic data
            </span>
            <span className="snapshot">Snapshot · 01 Nov 2026</span>
            <button aria-label="Refresh workspace" onClick={load}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <div className="demo-banner">
          <Info size={14} />
          <span>
            Every mapped movement is fictional. Real geography, transparent
            methods, human review.
          </span>
          <button onClick={() => go("sources")}>
            About the data <ArrowUpRight size={13} />
          </button>
        </div>
        <main>
          {tab === "map" && analyst && (
            <>
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <span className="flag-mark" /> Kerala, India <span>/</span>{" "}
                    Regional analysis
                  </div>
                  <h1>Follow the evidence.</h1>
                  <p>Documented connections. Every source within reach.</p>
                </div>
                <div className="heading-actions">
                  <button onClick={() => setShowImport(true)}>
                    <Upload size={15} /> Import records
                  </button>
                  <button className="primary" onClick={() => go("briefs")}>
                    <FileText size={15} /> Prepare brief
                  </button>
                </div>
              </div>
              <div className="filterbar">
                <form
                  className="searchbox primary-map-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setMapSearchRequest((n) => n + 1);
                  }}
                >
                  <Search size={16} />
                  <input
                    ref={searchRef}
                    aria-label="Search map features"
                    placeholder="Search roads, addresses, landmarks or destinations…"
                    maxLength={180}
                    value={mapQuery}
                    onChange={(e) => setMapQuery(e.target.value)}
                  />
                  <kbd>/</kbd>
                  <button type="submit" aria-label="Search map">
                    Search
                  </button>
                </form>
                <select
                  aria-label="Date range"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="2026-08-03">Last 90 days</option>
                  <option value="2026-10-01">October 2026</option>
                  <option value="2026-01-01">Year to date</option>
                  <option value="2025-01-01">Full scenario</option>
                </select>
                <select
                  aria-label="District"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="all">All districts</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Substance"
                  value={substance}
                  onChange={(e) => setSubstance(e.target.value)}
                >
                  <option value="all">All substances</option>
                  {["Cannabis", "Stimulants", "Opioids", "Other"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Evidence status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All evidence</option>
                  <option value="documented">Documented</option>
                  <option value="unreviewed">Unreviewed</option>
                  <option value="disputed">Disputed</option>
                </select>
                <select
                  aria-label="Source type"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="all">All sources</option>
                  <option value="movement">Movement register</option>
                  <option value="seizure">Seizure register</option>
                </select>
              </div>
              <div className="atlas-workspace">
                <section className="map-column">
                  <div className="map-statbar">
                    <span>
                      <strong>{activeCorridors.length}</strong> connections
                    </span>
                    <span>
                      <strong>{filtered.length}</strong> source records
                    </span>
                    <span>
                      <strong>
                        {
                          filtered.filter((r) => r.status === "documented")
                            .length
                        }
                      </strong>{" "}
                      documented
                    </span>
                    <button
                      className={hypotheses ? "toggle active" : "toggle"}
                      onClick={() => setHypotheses(!hypotheses)}
                    >
                      <span className="switch" /> Model hypotheses{" "}
                      <span className="experimental">Experimental</span>
                    </button>
                  </div>
                  <CorridorMap
                    records={filtered}
                    searchText={mapQuery}
                    onSearchTextChange={setMapQuery}
                    searchRequest={mapSearchRequest}
                    focusedDistrict={district}
                    selected={selected}
                    onSelect={setSelected}
                    forecast={data.forecast}
                    showHypotheses={hypotheses}
                    showPoints={points}
                    setShowPoints={setPoints}
                  />
                  {!filtered.length && (
                    <div className="empty-inline">
                      No records match these filters. Expand the date window or
                      choose all evidence.
                    </div>
                  )}
                  <div className="timeline">
                    <div className="timeline-top">
                      <div>
                        <Clock size={14} /> Explore over time <span>2026</span>
                      </div>
                      <button
                        aria-label={
                          playing ? "Pause timeline" : "Play timeline"
                        }
                        onClick={() => {
                          if (month >= 10) {
                            setMonth(1);
                            setPeriod("2026-01-01");
                          }
                          setPlaying(!playing);
                        }}
                      >
                        {playing ? <Pause size={13} /> : <Play size={13} />}{" "}
                        {playing ? "Pause" : "Play scenario"}
                      </button>
                    </div>
                    <div className="timeline-chart">
                      {chart.map((n, i) => (
                        <button
                          key={i}
                          aria-label={`Show through ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October"][i]} 2026`}
                          className={i + 1 <= month ? "included" : ""}
                          onClick={() => {
                            setMonth(i + 1);
                            if (
                              period >
                              `2026-${String(i + 1).padStart(2, "0")}-01`
                            )
                              setPeriod("2026-01-01");
                          }}
                        >
                          <span
                            style={{
                              height: `${Math.max((n / Math.max(...chart, 1)) * 35, 2)}px`,
                            }}
                          />
                          <small>
                            {
                              [
                                "Jan",
                                "Feb",
                                "Mar",
                                "Apr",
                                "May",
                                "Jun",
                                "Jul",
                                "Aug",
                                "Sep",
                                "Oct",
                              ][i]
                            }
                          </small>
                        </button>
                      ))}
                    </div>
                    <input
                      aria-label="Timeline month"
                      type="range"
                      min="1"
                      max="10"
                      value={month}
                      onChange={(e) => {
                        setMonth(+e.target.value);
                        setPeriod("2026-01-01");
                      }}
                    />
                  </div>
                </section>
                <aside className="inspector">
                  <div className="inspector-top">
                    <span>Connection explorer</span>
                    <span className="count-pill">{activeCorridors.length}</span>
                  </div>
                  <div className="connection-picker">
                    {activeCorridors.slice(0, 2).map((c) => (
                      <button
                        key={c.id}
                        className={selected === c.id ? "selected" : ""}
                        onClick={() => setSelected(c.id)}
                      >
                        <span className="route-dot" />
                        <span>
                          {placeName(c.origin).replace(" Urban", "")}
                          <small>{placeName(c.destination)}</small>
                        </span>
                        <span className="route-count">
                          {filtered.filter((r) => r.corridorId === c.id).length}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                    {activeCorridors.length > 2 && (
                      <select
                        aria-label="Choose another corridor"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        <option value={selected}>Choose any connection…</option>
                        {activeCorridors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {corridorName(c.id)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="selected-detail">
                    <div className="section-line">
                      <span className="small-label">Selected connection</span>
                      <Route size={16} />
                    </div>
                    <h2>
                      {placeName(selectedCorridor.origin).replace(" Urban", "")}{" "}
                      <ArrowRight size={18} />{" "}
                      {placeName(selectedCorridor.destination)}
                    </h2>
                    <div className="route-stops">
                      {[
                        selectedCorridor.origin,
                        ...selectedCorridor.transit,
                        selectedCorridor.destination,
                      ].map((p, i) => (
                        <div key={`${p}${i}`}>
                          <i />
                          {placeName(p).replace(" Urban", "")}
                          {i === 0 && <span>Origin</span>}
                          {i ===
                            [
                              selectedCorridor.origin,
                              ...selectedCorridor.transit,
                              selectedCorridor.destination,
                            ].length -
                              1 && <span>Destination</span>}
                        </div>
                      ))}
                    </div>
                    <div className="detail-grid">
                      <div>
                        <small>Transport</small>
                        <strong
                          className={`transport-mode mode-${selectedCorridor.mode.toLowerCase()}`}
                        >
                          {selectedCorridor.mode}
                        </strong>
                      </div>
                      <div>
                        <small>Precision</small>
                        <strong>District level</strong>
                      </div>
                      <div>
                        <small>Sources in view</small>
                        <strong>{corridorRecords.length} records</strong>
                      </div>
                      <div>
                        <small>Confidence</small>
                        <strong>
                          {corridorRecords.some(
                            (r) => r.status === "documented",
                          )
                            ? "Supported*"
                            : "Unknown"}
                        </strong>
                      </div>
                    </div>
                    <p className="confidence-footnote">
                      *Qualitative source assessment, not a measured
                      probability.
                    </p>
                    <div className="section-line">
                      <h3>Trace the evidence</h3>
                      <button
                        onClick={() => {
                          go("records");
                          setSearch(corridorName(selected));
                        }}
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    </div>
                    {corridorRecords.slice(0, 2).map((r) => (
                      <button
                        className="evidence-card"
                        key={r.id}
                        onClick={() => openRecord(r)}
                      >
                        <div>
                          <span>{r.id}</span>
                          <Badge status={r.status} />
                        </div>
                        <strong>
                          {r.substance} · {placeName(r.seizurePlace)}
                        </strong>
                        <small>
                          {r.eventDate}{" "}
                          <span>
                            Fictional source <ArrowUpRight size={12} />
                          </span>
                        </small>
                      </button>
                    ))}
                    {!corridorRecords.length && (
                      <p className="muted">
                        No source records for this connection in the current
                        filter.
                      </p>
                    )}
                    <div className="inspector-note">
                      <Info size={15} />
                      <p>
                        A connection joins reported districts. It does not
                        reconstruct a journey or establish wrongdoing.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "forecast" && (
            <div className="content-page">
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <Activity size={14} /> Transparent forecasting
                  </div>
                  <h1>A hypothesis to investigate.</h1>
                  <p>
                    Train, backtest and inspect aggregate forecasts. Evidence
                    before confidence.
                  </p>
                </div>
                <span className="label-amber">Experimental · human review</span>
              </div>
              <div
                className="forecast-view-tabs"
                aria-label="Forecast experiment"
              >
                <button
                  aria-pressed={forecastView === "trained"}
                  onClick={() => setForecastView("trained")}
                >
                  Trained pipeline
                </button>
                <button
                  aria-pressed={forecastView === "original"}
                  onClick={() => setForecastView("original")}
                >
                  Original scenario
                </button>
              </div>
              {forecastView === "trained" ? (
                <ModelLab analyst={analyst} />
              ) : (
                <>
                  <div className="forecast-intro">
                    <div>
                      <h2>What are we estimating?</h2>
                      <p>
                        The number of future <strong>documented cases</strong>{" "}
                        per district corridor in the next 30 days, from the
                        frozen 1 November 2026 scenario. This is a count
                        estimate, not a probability of actual trafficking.
                      </p>
                    </div>
                    <div className="method-chip">
                      <Network size={23} />
                      <span>
                        Weighted recent history
                        <small>
                          60% last 30d + 30% prior 30d + 10% prior 30d
                        </small>
                      </span>
                    </div>
                  </div>
                  <div className="evaluation-summary">
                    <div>
                      <small>Model mean absolute error</small>
                      <strong>
                        {mean("modelMae").toFixed(2)}{" "}
                        <span>cases / corridor</span>
                      </strong>
                    </div>
                    <div>
                      <small>90-day baseline error</small>
                      <strong>
                        {mean("baselineMae").toFixed(2)}{" "}
                        <span>cases / corridor</span>
                      </strong>
                    </div>
                    <div>
                      <small>Held-out windows</small>
                      <strong>
                        6 <span>chronological folds</span>
                      </strong>
                    </div>
                    <div>
                      <small>Real-world validation</small>
                      <strong className="amber-text">Not established</strong>
                    </div>
                  </div>
                  <div className="split-content">
                    <section className="panel">
                      <div className="panel-heading forecast-panel-heading">
                        <h2>Next 30 days · corridor ranking</h2>
                        <div>
                          <span className="forecast-key">
                            <span>
                              <i />
                              Model hypothesis
                            </span>
                            <span>
                              <i />
                              Baseline
                            </span>
                          </span>
                          <small className="forecast-window">
                            01–30 Nov 2026
                          </small>
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Connection</th>
                              <th>Model estimate</th>
                              <th>Baseline</th>
                              <th>Last 30d</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.forecast.map((r, i) => (
                              <tr key={r.corridorId}>
                                <td>
                                  <span className="rank">{i + 1}</span>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      if (analyst) {
                                        setSelected(r.corridorId);
                                        go("map");
                                      }
                                    }}
                                  >
                                    {corridorName(r.corridorId)}
                                  </button>
                                </td>
                                <td>
                                  <span className="estimate-track">
                                    <i
                                      style={{
                                        width: `${(r.estimate / Math.max(...data.forecast.map((f) => f.estimate), 1)) * 100}%`,
                                      }}
                                    />
                                    {r.estimate.toFixed(1)}
                                  </span>
                                </td>
                                <td>{r.baseline.toFixed(1)}</td>
                                <td>{r.recent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="table-footnote">
                        Planner view suppresses rows with fewer than five cases
                        in any training month. No calibrated interval is
                        available. Ranking ties use corridor ID; uncertainty is
                        not quantified. Counts are fictional.
                      </p>
                    </section>
                    <section className="limitations-panel">
                      <Info size={23} />
                      <h2>What this cannot tell you</h2>
                      {data.limitations.slice(0, 6).map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Walk-forward evaluation</h2>
                      <span>No shuffled train / test split</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Prediction date</th>
                            <th>Held-out through</th>
                            <th>Model MAE</th>
                            <th>Baseline MAE</th>
                            <th>Top 3 captured</th>
                            <th>Active corridors missed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.evaluation.map((f) => (
                            <tr key={f.cutoff}>
                              <td>{f.cutoff}</td>
                              <td>{f.end} (exclusive)</td>
                              <td>{f.modelMae.toFixed(2)}</td>
                              <td>{f.baselineMae.toFixed(2)}</td>
                              <td>
                                {f.captured} / {f.total} cases
                              </td>
                              <td>{f.misses}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="table-footnote">
                      Training uses only records available and reviewed before
                      each cutoff. Targets use 30-day event windows, with labels
                      frozen at 1 November. Late and missing reports can change
                      the apparent outcome. Import and review exercises do not
                      change this frozen experiment.
                    </p>
                  </section>
                  <section className="coverage-panel">
                    <h2>Coverage is a missing variable.</h2>
                    <p>
                      Enforcement effort, reporting completeness and population
                      coverage are unknown in this scenario. A high count can
                      reflect more observation. No district risk, demographic or
                      individual suspicion score is produced.
                    </p>
                  </section>
                </>
              )}
            </div>
          )}
          {tab === "records" && analyst && (
            <div className="content-page">
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <Files size={14} /> Source register
                  </div>
                  <h1>Nothing without a source.</h1>
                  <p>
                    Inspect provenance, geographic precision and the human
                    review trail.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowImport(true)}>
                  <Upload size={15} /> Import synthetic records
                </button>
              </div>
              <div className="library-tools">
                <div className="searchbox">
                  <Search size={16} />
                  <input
                    aria-label="Search evidence library"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search source ID, corridor or substance"
                  />
                </div>
                <select
                  aria-label="Library evidence status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All evidence</option>
                  <option value="documented">Documented</option>
                  <option value="unreviewed">Unreviewed</option>
                  <option value="disputed">Disputed</option>
                </select>
                <button
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setDistrict("all");
                    setSubstance("all");
                    setSource("all");
                    setPeriod("2025-01-01");
                    setMonth(10);
                    setPage(0);
                  }}
                >
                  Reset all filters
                </button>
                <span>{filtered.length} records · atlas filters apply</span>
              </div>
              <section className="panel">
                <div className="table-wrap">
                  <table className="record-table">
                    <thead>
                      <tr>
                        <th>Source reference</th>
                        <th>Documented connection</th>
                        <th>Event / available</th>
                        <th>Substance</th>
                        <th>Evidence</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(page * 15, (page + 1) * 15).map((r) => (
                        <tr key={r.id}>
                          <td>
                            <button
                              className="source-link"
                              onClick={() => openRecord(r)}
                            >
                              {r.id}
                            </button>
                            <small>Fictional source</small>
                          </td>
                          <td>
                            {corridorName(r.corridorId ?? "")}
                            <small>
                              {placeName(r.seizurePlace)} · district precision
                            </small>
                          </td>
                          <td>
                            {r.eventDate}
                            <small>Available {r.availableDate}</small>
                          </td>
                          <td>{r.substance}</td>
                          <td>
                            <Badge status={r.status} />
                          </td>
                          <td>
                            <button
                              aria-label={`Inspect ${r.id}`}
                              onClick={() => openRecord(r)}
                            >
                              <ArrowUpRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <div className="empty-state">
                      <Files size={30} />
                      <h3>No matching source records</h3>
                      <p>
                        Reset the filters or import a synthetic sample to
                        continue.
                      </p>
                    </div>
                  )}
                </div>
                <div className="pagination">
                  <span>
                    Page{" "}
                    {Math.min(
                      page + 1,
                      Math.max(1, Math.ceil(filtered.length / 15)),
                    )}{" "}
                    of {Math.max(1, Math.ceil(filtered.length / 15))}
                  </span>
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    disabled={(page + 1) * 15 >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </section>
              <div className="inspector-note">
                <Info size={16} />
                <p>
                  Seizure-only records have no corridor. Unknown origins,
                  quantities and transport modes remain unknown. Imported
                  records begin unreviewed and require evidence before inclusion
                  in documented analysis.
                </p>
              </div>
            </div>
          )}
          {tab === "tips" && analyst && (
            <div className="content-page">
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <MessageSquare size={14} /> Private review queue
                  </div>
                  <h1>Listen. Then corroborate.</h1>
                  <p>Community reports are leads, never ground truth.</p>
                </div>
                <button className="primary" onClick={() => setShowTip(true)}>
                  <Plus size={16} /> Try fictional intake
                </button>
              </div>
              <div className="notice-strip">
                <ShieldCheck size={18} />
                <p>
                  Private demonstration intake. No public allegations feed.
                  Reports never enter the forecast, including after review.
                </p>
                <a href="/report" target="_blank" rel="noreferrer">
                  Open intake page <ExternalLink size={13} />
                </a>
              </div>
              <div className="tip-grid">
                {data.tips.map((t) => (
                  <button
                    className="tip-card"
                    key={t.id}
                    onClick={() => openTip(t)}
                  >
                    <div>
                      <Badge status={t.status} />
                      <span>{t.createdAt.slice(0, 10)}</span>
                    </div>
                    <h2>{placeName(t.district)}</h2>
                    <p>{t.narrative}</p>
                    {t.duplicateGroup && (
                      <span className="duplicate-label">
                        <Network size={13} /> Possible repeated report · shared
                        cluster
                      </span>
                    )}
                    <footer>
                      <span>
                        {t.id.startsWith("TIP-DEMO")
                          ? t.id
                          : "Submitted exercise"}
                      </span>
                      <span>
                        Review lead <ArrowRight size={14} />
                      </span>
                    </footer>
                  </button>
                ))}
              </div>
              <div className="split-content">
                <section className="panel prose-panel">
                  <h2>Repeated reports are not corroboration.</h2>
                  <p>
                    District and recent narrative overlap flag potential
                    duplicate clusters. This heuristic can miss paraphrases and
                    coordinated activity; it does not establish independence or
                    truth. A reviewer must inspect source independence.
                  </p>
                </section>
                <section className="panel prose-panel">
                  <h2>Use the established reporting channel.</h2>
                  <p>
                    For actual reporting, consult Kerala Police’s existing
                    Yodhav channel. The prototype has no integration and sends
                    nothing to authorities.
                  </p>
                  <a
                    href="https://ps.keralapolice.gov.in/kothamangalam-ps/notifications/Yodhav--War-against-Narcotics-3332"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kerala Police · Yodhav information{" "}
                    <ExternalLink size={13} />
                  </a>
                </section>
              </div>
            </div>
          )}
          {tab === "briefs" && (
            <div className="content-page">
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <FileText size={14} /> From intelligence to discussion
                  </div>
                  <h1>Evidence with a purpose.</h1>
                  <p>
                    Prepare an aggregate brief for the people planning the
                    response.
                  </p>
                </div>
              </div>
              <div className="brief-layout">
                <section className="panel brief-builder">
                  <h2>Prepare a planning brief</h2>
                  <p className="muted">
                    Saved as a draft. Review before sharing through an
                    authorized channel.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        const b = await api<Brief>("briefs", {
                          title: briefTitle,
                          audience,
                          note: briefNote,
                        });
                        setActiveBrief(b);
                        await load();
                        setToast(
                          "Aggregate draft saved. Ready for human review.",
                        );
                      });
                    }}
                  >
                    <label>
                      Brief title
                      <input
                        required
                        minLength={5}
                        maxLength={150}
                        value={briefTitle}
                        onChange={(e) => setBriefTitle(e.target.value)}
                      />
                    </label>
                    <fieldset>
                      <legend>Recipient</legend>
                      {[
                        [
                          "enforcement",
                          "Enforcement review",
                          "Evidence and coverage questions",
                        ],
                        [
                          "prevention",
                          "Prevention coordinator",
                          "Outreach and helpline visibility",
                        ],
                        [
                          "health",
                          "Health & recovery planner",
                          "Capacity, access and local need",
                        ],
                      ]
                        .filter((x) => analyst || x[0] !== "enforcement")
                        .map(([id, title, desc]) => (
                          <label
                            key={id}
                            className={`audience-option ${audience === id ? "selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="audience"
                              value={id}
                              checked={audience === id}
                              onChange={() => setAudience(id)}
                            />
                            <span>
                              <strong>{title}</strong>
                              <small>{desc}</small>
                            </span>
                            {audience === id && <Check size={17} />}
                          </label>
                        ))}
                    </fieldset>
                    <label>
                      Discussion note <span className="muted">Optional</span>
                      <textarea
                        value={briefNote}
                        onChange={(e) => setBriefNote(e.target.value)}
                        maxLength={2000}
                        rows={4}
                        placeholder="What independent local information should the recipient review? Do not include identities or allegations."
                      />
                    </label>
                    <div className="inspector-note">
                      <ShieldCheck size={17} />
                      <p>
                        Source identities, raw leads and record IDs are
                        excluded. Groups below five are suppressed. A corridor
                        indicator alone does not establish service demand.
                      </p>
                    </div>
                    <button className="primary" disabled={busy}>
                      <FileText size={16} />
                      {busy ? "Preparing…" : "Generate aggregate draft"}
                    </button>
                  </form>
                </section>
                <section className="brief-preview">
                  <div className="panel-heading">
                    <h2>
                      {activeBrief
                        ? "Draft preview"
                        : "Your evidence, in context"}
                    </h2>
                    {activeBrief && (
                      <button
                        onClick={() =>
                          download(
                            `${activeBrief.title.replace(/[^a-z0-9]/gi, "-")}.md`,
                            activeBrief.content,
                          )
                        }
                      >
                        <Download size={14} /> Export Markdown
                      </button>
                    )}
                  </div>
                  {activeBrief ? (
                    <pre>{activeBrief.content}</pre>
                  ) : (
                    <div className="brief-placeholder">
                      <FileText size={55} strokeWidth={1} />
                      <h2>
                        A clear brief.
                        <br />A traceable conversation.
                      </h2>
                      <p>
                        Choose the recipient to shape the planning questions.
                        Documented aggregate connections and limitations travel
                        together.
                      </p>
                      <div>
                        <Check size={15} /> District-level aggregation
                      </div>
                      <div>
                        <Check size={15} /> Small-group suppression
                      </div>
                      <div>
                        <Check size={15} /> Human review required
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Saved drafts</h2>
                  <span>{data.briefs.length} drafts</span>
                </div>
                {data.briefs.length ? (
                  data.briefs.map((b) => (
                    <button
                      className="saved-brief"
                      key={b.id}
                      onClick={() => setActiveBrief(b)}
                    >
                      <FileText size={18} />
                      <span>
                        {b.title}
                        <small>
                          {b.audience} · {b.createdAt.slice(0, 10)}
                        </small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))
                ) : (
                  <p className="empty-inline">
                    Your first draft will appear here after you generate it.
                  </p>
                )}
              </section>
            </div>
          )}
          {tab === "sources" && (
            <div className="content-page">
              <div className="page-heading">
                <div>
                  <div className="location-kicker">
                    <BookOpen size={14} /> Provenance & methodology
                  </div>
                  <h1>Built to be questioned.</h1>
                  <p>
                    An independent hackathon prototype. Working title: Corridor.
                  </p>
                </div>
              </div>
              <div className="sources-hero">
                <Network size={46} strokeWidth={1} />
                <div>
                  <h2>Real geography. Fictional movements.</h2>
                  <p>
                    All 761 seed records, reviewer identities and community
                    scenarios are synthetic. No live agency data, authorization
                    or partnership is claimed. Public aggregate statistics
                    provide context and never become corridor evidence.
                  </p>
                </div>
              </div>
              <div className="split-content">
                <section className="panel prose-panel">
                  <h2>Public context · Kerala Police</h2>
                  <p>
                    Registered NDPS Act cases, statewide. Full calendar years;
                    this is not a measure of trafficking prevalence or treatment
                    need.
                  </p>
                  <div className="context-chart">
                    {[
                      [2020, 4968],
                      [2021, 5695],
                      [2022, 26619],
                      [2023, 30697],
                      [2024, 27530],
                      [2025, 36314],
                    ].map(([y, n]) => (
                      <div key={y}>
                        <strong>{n.toLocaleString("en-IN")}</strong>
                        <i style={{ height: `${(n / 36314) * 100}px` }} />
                        <span>{y}</span>
                      </div>
                    ))}
                  </div>
                  <a
                    href="https://keralapolice.gov.in/crime-statistics/sll-cases"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kerala Police · SLL statistics <ExternalLink size={13} />
                  </a>
                  <p className="fineprint">
                    Retrieved 1 Nov 2026. Counts can be revised. Police and
                    combined-agency series can differ; do not combine them.
                  </p>
                </section>
                <section className="limitations-panel">
                  <h2>What this cannot tell you</h2>
                  {data.limitations.map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </section>
              </div>
              <section className="panel prose-panel">
                <h2>Source register</h2>
                {[
                  [
                    "Open Data Kerala / OpenStreetMap",
                    "District boundary polygons, simplified for this display. Adapted geographic database is ODbL 1.0. © OpenStreetMap contributors.",
                    "https://github.com/opendatakerala/kl_district",
                  ],
                  [
                    "OpenStreetMap street basemap",
                    "Detailed online roads and place labels, displayed in grayscale. Tile availability and public-map coverage vary. No case data or lead narratives are sent to the basemap provider.",
                    "https://operations.osmfoundation.org/policies/tiles/",
                  ],
                  [
                    "Photon / OpenStreetMap search",
                    "Live public-map search for roads, addresses, landmarks and destinations. Explicit submissions are cached and rate-limited; provider coverage and availability vary. Results include the original OSM object and mapped extent.",
                    "https://github.com/komoot/photon",
                  ],
                  [
                    "GeoNames",
                    "6,364 locality profiles, 14 districts and 194 catalogued transport features. Source-linked administrative, population, elevation and time-zone fields, CC BY 4.0. Population years and operating status may be unknown. Geographic context only.",
                    "https://www.geonames.org/",
                  ],
                  [
                    "Natural Earth",
                    "Public-domain country geometry for regional context. Boundaries are illustrative, not authoritative.",
                    "https://www.naturalearthdata.com/about/terms-of-use/",
                  ],
                  [
                    "UNODC Drugs Monitoring Platform",
                    "Methodology reference. Only reported significant seizures; incomplete coverage and possible duplication. No IDS records used as Kerala movements.",
                    "https://dmpone.unodc.org/downloadIDS",
                  ],
                  [
                    "Kerala Police / Yodhav",
                    "Existing reporting-channel reference. No integration with this prototype.",
                    "https://ps.keralapolice.gov.in/kothamangalam-ps/notifications/Yodhav--War-against-Narcotics-3332",
                  ],
                ].map(([title, desc, url]) => (
                  <a
                    className="source-row"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    key={title}
                  >
                    <BookOpen size={18} />
                    <span>
                      <strong>{title}</strong>
                      <small>{desc}</small>
                    </span>
                    <ExternalLink size={15} />
                  </a>
                ))}
              </section>
              <section className="panel prose-panel">
                <h2>Access & data handling</h2>
                <p>
                  The hosted site is owner-private behind ChatGPT sign-in.
                  Analyst and planner are switchable demonstration roles,
                  enforced by the API, not agency authorization. Planner
                  responses exclude individual records, leads and review
                  identities. Uploaded records, reviews and briefs are scoped to
                  the signed-in user; private demonstration leads are visible to
                  signed-in analysts.
                </p>
                <p>
                  Tip intake accepts fictional exercises only, with optional
                  contact information. No anonymity guarantee is made: hosting
                  infrastructure may retain access logs. The hosted private gate
                  also applies to the intake page; local intake can be exercised
                  without creating an account. No production retention policy or
                  agency reporting connection exists.
                </p>
                <p>
                  Before operational use: agency participation,
                  membership-backed role provisioning, legal review, retention
                  rules, independent security assessment and real-data
                  evaluation are required.
                </p>
              </section>
            </div>
          )}
          {!analyst && tab === "map" && (
            <div className="content-page">
              <h1>Service planner workspace</h1>
              <p>
                Open the forecast lab or prepare an aggregate planning brief.
              </p>
              <button className="primary" onClick={() => go("forecast")}>
                Open forecast lab
              </button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>Corridor · independent hackathon prototype</span>
          <span>Evidence informs. People decide.</span>
          <span>
            <span className="signal-dot" /> Frozen synthetic scenario
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {tour !== null && (
        <div
          className="tour-panel"
          role="region"
          aria-label="Guided demonstration"
        >
          <div>
            <span>Guided demo · {tour + 1} of 5</span>
            <button aria-label="End guided demo" onClick={() => setTour(null)}>
              <X size={16} />
            </button>
          </div>
          <h2>
            {
              [
                "Start with a connection",
                "Open the evidence",
                "Challenge the forecast",
                "Review, never assume",
                "Prepare a responsible brief",
              ][tour]
            }
          </h2>
          <p>
            {
              [
                "Select a route on the map. Its district endpoints, source records and limitations appear in the inspector. Try the timeline to see the fictional scenario develop.",
                "Click a source reference to inspect dates, evidence confidence and review history. Unknowns remain explicit.",
                "Compare weighted history with a simple baseline and examine six chronological evaluation windows. These are synthetic results.",
                "Two fictional leads share a cluster. Similar reports do not provide independent confirmation, and no tip changes the forecast.",
                "Choose an audience and generate an aggregate draft. Evidence, privacy suppression and planning limitations remain together.",
              ][tour]
            }
          </p>
          <button className="primary" onClick={nextTour}>
            {tour === 4 ? "Finish walkthrough" : "Next stop"}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {record && (
        <Modal
          title={`Evidence trail · ${record.id}`}
          onClose={() => setRecord(null)}
          wide
        >
          <div className="record-modal">
            <div className="record-title">
              <Badge status={record.status} />
              <span className="demo-pill">Synthetic record</span>
            </div>
            <h2>{corridorName(record.corridorId ?? "")}</h2>
            <div className="detail-grid">
              <div>
                <small>Event date</small>
                <strong>{record.eventDate}</strong>
              </div>
              <div>
                <small>Available to analyst</small>
                <strong>{record.availableDate}</strong>
              </div>
              <div>
                <small>Source date</small>
                <strong>{record.sourceDate}</strong>
              </div>
              <div>
                <small>Geographic precision</small>
                <strong>{record.precision}</strong>
              </div>
              <div>
                <small>Substance / quantity</small>
                <strong>
                  {record.substance} /{" "}
                  {record.quantity === null
                    ? "Unknown"
                    : `${record.quantity} ${record.unit}`}
                </strong>
              </div>
              <div>
                <small>Seizure location</small>
                <strong>{placeName(record.seizurePlace)}</strong>
              </div>
            </div>
            <h3>Source reference</h3>
            <p>{record.source}</p>
            <blockquote>{record.excerpt}</blockquote>
            <h3>Confidence: {record.confidence}</h3>
            <p>{record.confidenceBasis}</p>
            <small className="muted">
              Qualitative evidence assessment. Not a measured probability.
            </small>
            <h3>Review history</h3>
            <div className="audit-entry">
              <ShieldCheck size={17} />
              <span>
                {record.reviewer ?? "No reviewer assigned"}
                <small>
                  {record.reviewedAt ?? "Unreviewed"} · {record.status}
                </small>
              </span>
            </div>
            {data.reviews
              .filter((r) => r.entityId === record.id)
              .map((r) => (
                <div className="audit-entry" key={r.id}>
                  <Clock size={16} />
                  <span>
                    {r.status} · {r.actor}
                    <small>{r.createdAt}</small>
                    <p>{r.note}</p>
                    {r.evidenceId && (
                      <small>Linked evidence: {r.evidenceId}</small>
                    )}
                  </span>
                </div>
              ))}
            <details className="review-form">
              <summary>Record an analyst review</summary>
              <label>
                Evidence status
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                >
                  <option value="documented">Documented</option>
                  <option value="disputed">Disputed</option>
                  <option value="unreviewed">Unreviewed</option>
                </select>
              </label>
              {reviewStatus === "documented" && (
                <>
                  <label>
                    Independent documented source ID
                    <input
                      value={evidenceId}
                      onChange={(e) => setEvidenceId(e.target.value)}
                      placeholder="SYN-0001"
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={independent}
                      onChange={(e) => setIndependent(e.target.checked)}
                    />{" "}
                    I checked that this source is independent and supports the
                    same district connection.
                  </label>
                </>
              )}
              <label>
                Review basis
                <textarea
                  rows={3}
                  minLength={20}
                  maxLength={2000}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Describe the corroboration, contradictions and remaining uncertainty (at least 20 characters)."
                />
              </label>
              <button
                className="primary"
                disabled={busy || reviewNote.trim().length < 20}
                onClick={() => review("case", record.id)}
              >
                Save review
              </button>
            </details>
            <button
              onClick={() =>
                download(
                  `${record.id}.json`,
                  JSON.stringify(record, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={14} /> Export this synthetic source
            </button>
          </div>
        </Modal>
      )}
      {showImport && (
        <Modal
          title="Import synthetic evidence"
          onClose={() => setShowImport(false)}
        >
          <div className="modal-body">
            <p>
              Import a JSON array of up to 100 fictional records. Every new
              record starts unreviewed. Existing IDs are rejected; provenance is
              preserved.
            </p>
            <a className="download-sample" href="/sample-import.json" download>
              <Download size={17} /> Download the valid sample
            </a>
            <div className="upload-zone">
              <Upload size={32} />
              <h3>Choose a scenario file</h3>
              <p>JSON · under 500 KB · synthetic records only</p>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                aria-label="Upload synthetic records"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  act(async () => {
                    if (f.size > 500000)
                      throw Error("File must be under 500 KB.");
                    const rows = JSON.parse(await f.text());
                    const r = await api<{ imported: number }>("records", rows);
                    await load();
                    setShowImport(false);
                    setToast(
                      `${r.imported} synthetic record imported. Analyst review required.`,
                    );
                  });
                }}
              />
            </div>
            <p className="fineprint">
              Use only the fictional exercise schema. No real case files, names,
              IDs, patient information or agency records.
            </p>
          </div>
        </Modal>
      )}
      {showTip && (
        <Modal title="Try the private intake" onClose={() => setShowTip(false)}>
          <TipForm
            onSaved={() => {
              load();
              setShowTip(false);
              setToast("Fictional lead saved privately for review.");
            }}
          />
        </Modal>
      )}
      {tip && (
        <Modal title="Private lead review" onClose={() => setTip(null)}>
          <div className="modal-body">
            <Badge status={tip.status} />
            <h2>{placeName(tip.district)}</h2>
            <p>{tip.narrative}</p>
            {tip.contact && <p>Optional contact: {tip.contact}</p>}
            {tip.duplicateGroup && (
              <div className="notice-strip">
                <Network size={18} />
                <p>
                  Possible duplicate cluster: {tip.duplicateGroup}. Treat
                  repeated allegations as one lead pending source review.
                </p>
              </div>
            )}
            <p className="muted">
              This lead is excluded from every forecast and training dataset.
            </p>
            {data.reviews
              .filter((r) => r.entityId === tip.id)
              .map((r) => (
                <div className="audit-entry" key={r.id}>
                  <Clock size={16} />
                  <span>
                    {r.status} · {r.actor}
                    <small>{r.createdAt}</small>
                    <p>{r.note}</p>
                    {r.evidenceId && (
                      <small>Linked independent source: {r.evidenceId}</small>
                    )}
                  </span>
                </div>
              ))}
            <label>
              Review outcome
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
              >
                <option value="triaged">Triaged · needs follow-up</option>
                <option value="dismissed">
                  Dismissed · unsupported / duplicate
                </option>
                <option value="corroborated">Independently corroborated</option>
              </select>
            </label>
            {reviewStatus === "corroborated" && (
              <>
                <label>
                  Documented independent record
                  <input
                    value={evidenceId}
                    onChange={(e) => setEvidenceId(e.target.value)}
                    placeholder="Source ID in the same district"
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={independent}
                    onChange={(e) => setIndependent(e.target.checked)}
                  />{" "}
                  Source independence checked; similarity alone is not
                  corroboration.
                </label>
              </>
            )}
            <label>
              Review note
              <textarea
                rows={4}
                maxLength={2000}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Record your basis and unresolved questions (at least 20 characters)."
              />
            </label>
            <button
              className="primary"
              disabled={busy || reviewNote.trim().length < 20}
              onClick={() => review("tip", tip.id)}
            >
              Save lead review
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
