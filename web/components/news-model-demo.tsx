"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  ShieldAlert,
  Info,
  GitBranch,
  Calendar,
  Layers,
  Navigation,
  MapPin,
  Truck,
  AlertTriangle,
  Radio,
  CornerDownRight,
  ArrowRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import demoMonthly from "../data/news-demo.json";
import backtestData from "../data/corridor-backtest.json";
import transitData from "../data/transit-intelligence.json";

type MonthlyMethod = keyof (typeof demoMonthly.rows)[number]["expected"];
const monthlyMethodNames: Record<string, string> = {
  district_history: "Historical district average",
  district_recent_3m: "Recent three-month average",
  poisson_district_calendar: "Poisson model v1",
  poisson_linear: "Poisson GLM",
  hist_gradient_boosting: "HistGradientBoosting (Poisson)",
};

export default function NewsModelDemo() {
  const [viewMode, setViewMode] = useState<"next_hop_transit" | "weekly_corridor" | "monthly_block">("next_hop_transit");
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [activeDisplacementIdx, setActiveDisplacementIdx] = useState(0);

  // State for weekly corridor backtest
  const timeline = backtestData.timeline;
  const [sliderIndex, setSliderIndex] = useState(timeline.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedWeeklyModel, setSelectedWeeklyModel] = useState<"corridors" | "own_history" | "baseline">("corridors");
  const [showHypotheses, setShowHypotheses] = useState(false);

  // State for monthly block demo
  const [month, setMonth] = useState(demoMonthly.months[0]);
  const [monthlyMethod, setMonthlyMethod] = useState<MonthlyMethod>(demoMonthly.selected as MonthlyMethod);

  // Animation effect for weekly time slider
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSliderIndex((curr) => {
        if (curr >= timeline.length - 1) {
          setIsPlaying(false);
          return curr;
        }
        return curr + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, timeline.length]);

  const currentWeek = timeline[sliderIndex] || timeline[0];
  const maxWeeklyVal = Math.max(
    ...currentWeek.districts.flatMap((d) => [d.observed, d.predicted, d.interval_high]),
    4
  );

  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const monthName = (m: string) =>
    new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${m}-01T00:00:00Z`));

  const monthlyScore = demoMonthly.methods.find((item) => item.id === monthlyMethod)!;
  const monthlySelected = demoMonthly.methods.find((item) => item.id === demoMonthly.selected)!;
  const { tp, fp, fn, tn } = monthlyScore.confusion;
  const monthlyRows = demoMonthly.rows
    .filter((row) => row.month === month)
    .sort(
      (a, b) =>
        b.expected[monthlyMethod] - a.expected[monthlyMethod] ||
        a.district.localeCompare(b.district)
    );
  const maxMonthlyCount = Math.max(
    ...demoMonthly.rows.flatMap((row) => [row.observed, ...Object.values(row.expected)])
  );

  return (
    <div className="news-model" data-testid="news-model">
      {/* Honest Framing Banner */}
      <div
        style={{
          background: "rgba(234, 179, 8, 0.12)",
          border: "1px solid rgba(234, 179, 8, 0.4)",
          borderRadius: "8px",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        <ShieldAlert style={{ color: "#eab308", flexShrink: 0, marginTop: "2px" }} size={22} />
        <div>
          <strong style={{ color: "#fef08a", fontSize: "0.95rem" }}>
            Fundamental Design Principle: We Model Seizure Intensity, NOT Absolute Drug Flow
          </strong>
          <p style={{ margin: "0.3rem 0 0", color: "#fef9c3", fontSize: "0.85rem", lineHeight: "1.45" }}>
            Seizure records measure where law enforcement intercepts contraband, not the complete unobserved trafficking journey.
            Border checkposts like <strong>Muthanga</strong> and <strong>Walayar</strong> dominate statistical distributions because they are under constant surveillance, not necessarily because they carry all traffic.
            Corridor frames every forecast as <em>interception pressure and transit intensity</em>.
          </p>
        </div>
      </div>

      {/* Model Mode Toggle & Summary */}
      <div className="news-model-context" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Operation Toofan Intelligence & Movement Forecaster</h2>
          <p>
            Hierarchical multi-scale forecasting: Micro Next-Hop Route Diffusion for intercept teams and Macro Spatiotemporal Intensity across 14 Kerala districts.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              className={`button ${viewMode === "next_hop_transit" ? "primary" : ""}`}
              onClick={() => setViewMode("next_hop_transit")}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <Navigation size={14} /> Next-Hop Movement Forecaster
            </button>
            <button
              className={`button ${viewMode === "weekly_corridor" ? "primary" : ""}`}
              onClick={() => setViewMode("weekly_corridor")}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <BarChart3 size={14} /> 2-Week Rolling Forecaster ({timeline.length} Wks)
            </button>
            <button
              className={`button ${viewMode === "monthly_block" ? "primary" : ""}`}
              onClick={() => setViewMode("monthly_block")}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <Calendar size={14} /> 5-Month Block Replay
            </button>
          </div>
        </div>

        {viewMode === "next_hop_transit" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              textAlign: "right",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "flex-end" }}>
              <Cpu size={18} style={{ color: "#38bdf8" }} />
              <strong style={{ color: "#38bdf8", fontSize: "1.05rem" }}>
                Hybrid Dirichlet-Markov + GBDT
              </strong>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              1,200 Unified Incidents (News + High Court NDPS)
            </div>
            <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.2rem" }}>
              Inference Latency: &lt;1ms · Zero Cloud GPU Needed
            </div>
          </div>
        )}

        {viewMode === "weekly_corridor" && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              textAlign: "right",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "flex-end" }}>
              <TrendingDown size={18} style={{ color: "#10b981" }} />
              <strong style={{ color: "#10b981", fontSize: "1.1rem" }}>
                +{backtestData.summary.headline_lift_pct}% Lift
              </strong>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Poisson deviance: {backtestData.summary.baseline.poisson_deviance} (base) → {backtestData.summary.corridors.poisson_deviance} (corridors)
            </div>
            <div style={{ fontSize: "0.75rem", color: "#38bdf8", marginTop: "0.2rem" }}>
              Interval Coverage: {(backtestData.summary.interval_coverage * 100).toFixed(1)}% (p10–p90)
            </div>
          </div>
        )}
      </div>

      {viewMode === "next_hop_transit" ? (
        <section style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Scenario Selector */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Navigation size={18} style={{ color: "#38bdf8" }} />
                  Live Interception Scenario & Next-Hop Simulation
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Select an interception checkpoint, contraband consignment, and transit modality to forecast destination routing
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "0.2rem 0.6rem", borderRadius: "4px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                Dirichlet-Markov + GBDT Ensemble
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.5rem" }}>
              {transitData.scenarios.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveScenarioIdx(idx)}
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    border: activeScenarioIdx === idx ? "1px solid #38bdf8" : "1px solid var(--border)",
                    background: activeScenarioIdx === idx ? "rgba(56, 189, 248, 0.12)" : "rgba(0,0,0,0.2)",
                    color: activeScenarioIdx === idx ? "#ffffff" : "var(--muted)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: activeScenarioIdx === idx ? "#38bdf8" : "var(--foreground)", marginBottom: "0.2rem" }}>
                    {sc.scenario_title}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", fontSize: "0.7rem" }}>
                    <span style={{ textTransform: "uppercase", background: "rgba(255,255,255,0.08)", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>
                      {sc.substance} ({sc.quantity_g}g)
                    </span>
                    <span style={{ textTransform: "capitalize", color: "#a855f7" }}>
                      {sc.transport_mode.replace("_", " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Scenario Detailed Dashboard */}
          {(() => {
            const currentScenario = transitData.scenarios[activeScenarioIdx] || transitData.scenarios[0];
            const topDest = currentScenario.predicted_destinations[0];

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
                {/* Left: Probabilities and Transit Path */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#38bdf8" }}>
                        Active Consignment Forecast
                      </span>
                      <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.2rem" }}>
                        {currentScenario.scenario_title}
                      </h3>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "4px",
                        fontWeight: 600,
                        background: currentScenario.is_commercial ? "rgba(239, 68, 68, 0.2)" : "rgba(234, 179, 8, 0.2)",
                        color: currentScenario.is_commercial ? "#f87171" : "#facc15",
                        border: currentScenario.is_commercial ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(234, 179, 8, 0.4)",
                      }}
                    >
                      {currentScenario.is_commercial ? "COMMERCIAL SCALE" : "RETAIL SCALE"}
                    </span>
                  </div>

                  <h4 style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                    Top Predicted Destination Districts (Probability & Transit Arrival Window)
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.5rem" }}>
                    {currentScenario.predicted_destinations.map((dest, dIdx) => (
                      <div
                        key={dIdx}
                        style={{
                          background: "rgba(0,0,0,0.25)",
                          borderRadius: "6px",
                          padding: "0.75rem 1rem",
                          border: dIdx === 0 ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ color: dIdx === 0 ? "#38bdf8" : "var(--muted)", fontSize: "0.8rem" }}>#{dest.rank}</span>
                            {dest.district}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: dIdx === 0 ? "#38bdf8" : "var(--foreground)" }}>
                            {dest.probability}%
                          </span>
                        </div>

                        {/* Probability Progress Bar */}
                        <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden", marginBottom: "0.6rem" }}>
                          <div
                            style={{
                              width: `${dest.probability}%`,
                              height: "100%",
                              background: dIdx === 0 ? "linear-gradient(90deg, #38bdf8, #818cf8)" : "#94a3b8",
                              borderRadius: "3px",
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", flexWrap: "wrap", gap: "0.3rem" }}>
                          <span>Est. Distance: <strong style={{ color: "var(--foreground)" }}>{dest.distance_km} km</strong></span>
                          <span>Transit Duration: <strong style={{ color: "#10b981" }}>{dest.estimated_transit_hours} hrs</strong></span>
                          <span>Arrival Window: <strong style={{ color: "#fbbf24" }}>{dest.arrival_window}</strong></span>
                        </div>

                        {/* Waypoint Route Flow */}
                        <div style={{ marginTop: "0.5rem", paddingTop: "0.4rem", borderTop: "1px dashed rgba(255,255,255,0.08)", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                          <CornerDownRight size={12} style={{ color: "#38bdf8" }} />
                          <span style={{ color: "var(--muted)" }}>Corridor Path:</span>
                          {dest.waypoint_path.map((node, nIdx) => (
                            <span key={nIdx} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                              <strong style={{ color: nIdx === dest.waypoint_path.length - 1 ? "#38bdf8" : "var(--foreground)" }}>{node}</strong>
                              {nIdx < dest.waypoint_path.length - 1 && <ArrowRight size={10} style={{ color: "var(--muted)" }} />}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Dual-Pane Tactical & Community Guidance */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* Tactical Enforcer Guidance */}
                  <div
                    style={{
                      background: "rgba(30, 58, 138, 0.15)",
                      border: "1px solid rgba(59, 130, 246, 0.4)",
                      borderRadius: "8px",
                      padding: "1.25rem",
                    }}
                  >
                    <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#60a5fa", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <ShieldCheck size={18} style={{ color: "#60a5fa" }} />
                      Enforcement Tactical Directives (Operation Toofan)
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", lineHeight: "1.55", color: "#dbeafe" }}>
                      {currentScenario.enforcer_tactical_directive.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: "0.4rem" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Community Early Warning Guidance */}
                  <div
                    style={{
                      background: "rgba(120, 53, 15, 0.15)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      borderRadius: "8px",
                      padding: "1.25rem",
                    }}
                  >
                    <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <AlertTriangle size={18} style={{ color: "#fbbf24" }} />
                      Community Youth Protection & Vigilance Advisory
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", lineHeight: "1.55", color: "#fef3c7" }}>
                      {currentScenario.community_early_warning.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: "0.4rem" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Border Enforcement Displacement Simulator */}
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <RefreshCw size={15} style={{ color: "#a855f7" }} />
                        Checkpost Choke Simulator (Network Displacement)
                      </h4>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {transitData.displacement_simulations.map((sim, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => setActiveDisplacementIdx(sIdx)}
                            className={`button ${activeDisplacementIdx === sIdx ? "primary" : ""}`}
                            style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                          >
                            {sim.checkpost_name.replace(" Checkpost", "")} +50%
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const curSim = transitData.displacement_simulations[activeDisplacementIdx] || transitData.displacement_simulations[0];
                      return (
                        <div>
                          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 0.6rem", lineHeight: "1.4" }}>
                            {curSim.impact_summary}
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            {curSim.rerouting_distribution.map((r, rIdx) => (
                              <div key={rIdx} style={{ background: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                                  <span style={{ color: "var(--foreground)" }}>{r.corridor}</span>
                                  <span style={{ color: "#38bdf8" }}>{r.share_pct}%</span>
                                </div>
                                <div style={{ color: "#10b981", fontSize: "0.7rem", marginTop: "0.2rem" }}>
                                  {r.risk_change}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      ) : viewMode === "weekly_corridor" ? (
        <section className="news-model-grid" style={{ marginTop: "1.5rem" }}>
          {/* Main Replay Column */}
          <div className="news-model-replay" style={{ flex: 1 }}>
            {/* Interactive Time Slider Controls */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Backtest Time Replay Slider</h3>
                  <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600 }}>
                    Forecast Cutoff: Week of {currentWeek.week_start}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={() => setSliderIndex((i) => Math.max(0, i - 1))}
                    disabled={sliderIndex === 0}
                    style={{ padding: "0.3rem 0.5rem", borderRadius: "4px" }}
                    title="Previous week"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="button primary"
                    style={{ padding: "0.3rem 0.8rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={() => setSliderIndex((i) => Math.min(timeline.length - 1, i + 1))}
                    disabled={sliderIndex === timeline.length - 1}
                    style={{ padding: "0.3rem 0.5rem", borderRadius: "4px" }}
                    title="Next week"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min={0}
                max={timeline.length - 1}
                value={sliderIndex}
                onChange={(e) => {
                  setSliderIndex(Number(e.target.value));
                  setIsPlaying(false);
                }}
                style={{ width: "100%", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem" }}>
                <span>{timeline[0].week_start} (Evaluation Start)</span>
                <span>Week {sliderIndex + 1} of {timeline.length}</span>
                <span>{timeline[timeline.length - 1].week_start} (Latest Test)</span>
              </div>
            </div>

            {/* Replay Table */}
            <div className="news-model-legend" style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <span>
                  <i style={{ background: "#38bdf8" }} /> Predicted Count (with p10–p90 interval)
                </span>
                <span>
                  <i style={{ background: "#f43f5e" }} /> Observed Seizures
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    background: selectedWeeklyModel === "corridors" ? "#0284c7" : "transparent",
                    color: "white",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setSelectedWeeklyModel("corridors")}
                >
                  GBM + Corridors
                </button>
                <button
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    background: selectedWeeklyModel === "own_history" ? "#0284c7" : "transparent",
                    color: "white",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setSelectedWeeklyModel("own_history")}
                >
                  Own History Only
                </button>
                <button
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem",
                    background: selectedWeeklyModel === "baseline" ? "#0284c7" : "transparent",
                    color: "white",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setSelectedWeeklyModel("baseline")}
                >
                  Rolling Baseline
                </button>
              </div>
            </div>

            <table className="news-model-districts">
              <thead>
                <tr>
                  <th scope="col">District</th>
                  <th scope="col">Predicted (2-Week)</th>
                  <th scope="col">Observed</th>
                  <th scope="col">Plain-English Attribution</th>
                </tr>
              </thead>
              <tbody>
                {currentWeek.districts.map((row) => {
                  const predVal =
                    selectedWeeklyModel === "corridors"
                      ? row.predicted
                      : selectedWeeklyModel === "own_history"
                      ? row.predicted_own
                      : row.predicted_base;

                  return (
                    <tr key={row.district}>
                      <th scope="row">{row.district}</th>
                      <td style={{ minWidth: "160px" }}>
                        <div className="news-model-bar">
                          <span
                            style={{
                              width: `${Math.min(100, (predVal / maxWeeklyVal) * 100)}%`,
                              background: "#38bdf8",
                            }}
                          />
                          <b>{predVal.toFixed(2)}</b>
                          <small style={{ color: "var(--muted)", marginLeft: "4px" }}>
                            [{row.interval_low.toFixed(1)}–{row.interval_high.toFixed(1)}]
                          </small>
                        </div>
                      </td>
                      <td style={{ minWidth: "100px" }}>
                        <div className="news-model-bar observed">
                          <span
                            style={{
                              width: `${Math.min(100, (row.observed / maxWeeklyVal) * 100)}%`,
                              background: "#f43f5e",
                            }}
                          />
                          <b>{row.observed}</b>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", maxWidth: "260px" }}>
                        {row.reasons.join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Model Comparison Metrics & Corridors Hypotheses */}
          <aside className="news-model-score">
            <h3>Rigorous Model Benchmark</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Evaluated strictly on held-out forward blocks over {backtestData.timeline.length} weeks. No deep learning, simple shallow models.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.75rem" }}>
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>GBM + Upstream Corridors</strong>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>Winner</span>
                </div>
                <div style={{ fontSize: "0.8rem", display: "flex", justifyContent: "space-between", marginTop: "0.3rem" }}>
                  <span>Poisson Dev: <b>1.350</b></span>
                  <span>MAE: <b>0.859</b></span>
                  <span>Hit@3: <b>36%</b></span>
                </div>
              </div>

              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>GBM Own-History Only</span>
                </div>
                <div style={{ fontSize: "0.8rem", display: "flex", justifyContent: "space-between", marginTop: "0.3rem", color: "var(--muted)" }}>
                  <span>Poisson Dev: 1.382</span>
                  <span>MAE: 0.870</span>
                  <span>Hit@3: 37%</span>
                </div>
              </div>

              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Rolling-Mean Baseline</span>
                </div>
                <div style={{ fontSize: "0.8rem", display: "flex", justifyContent: "space-between", marginTop: "0.3rem", color: "var(--muted)" }}>
                  <span>Poisson Dev: 1.601</span>
                  <span>MAE: 0.832</span>
                  <span>Hit@3: 37%</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
              <button
                className="button"
                onClick={() => setShowHypotheses(!showHypotheses)}
                style={{ width: "100%", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span>Corridor Lead-Lag Hypotheses ({backtestData.lead_lags.length} routes)</span>
                <span>{showHypotheses ? "▲" : "▼"}</span>
              </button>

              {showHypotheses && (
                <div style={{ marginTop: "0.75rem", maxHeight: "250px", overflowY: "auto", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {backtestData.lead_lags.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.4rem 0.6rem",
                        background: item.hypothesis_supported ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.03)",
                        borderLeft: `3px solid ${item.hypothesis_supported ? "#10b981" : "#64748b"}`,
                        borderRadius: "2px",
                      }}
                    >
                      <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                        <span>{item.upstream} → {item.downstream}</span>
                        <span style={{ color: item.hypothesis_supported ? "#10b981" : "#94a3b8" }}>
                          {item.optimal_lag_days}
                        </span>
                      </div>
                      <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                        {item.interpretation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      ) : (
        /* Monthly Block Replay */
        <section className="news-model-grid" aria-label="Holdout replay and performance">
          <div className="news-model-replay">
            <div className="news-model-replay-head">
              <div>
                <h3>Holdout replay</h3>
                <p>June–October 2026 (70 District-Months)</p>
              </div>
              <label>
                Test month
                <select
                  aria-label="Test month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  {demoMonthly.months.map((value) => (
                    <option key={value} value={value}>
                      {monthName(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="news-model-legend">
              <span>
                <i /> Predicted count
              </span>
              <span>
                <i /> Observed in collection
              </span>
            </div>
            <table className="news-model-districts">
              <thead>
                <tr>
                  <th scope="col">District</th>
                  <th scope="col">Predicted</th>
                  <th scope="col">Observed</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.district}>
                    <th scope="row">{row.district}</th>
                    <td>
                      <div className="news-model-bar">
                        <span
                          style={{
                            width: `${(row.expected[monthlyMethod] / maxMonthlyCount) * 100}%`,
                          }}
                        />
                        <b>{row.expected[monthlyMethod].toFixed(2)}</b>
                      </div>
                    </td>
                    <td>
                      <div className="news-model-bar observed">
                        <span
                          style={{ width: `${(row.observed / maxMonthlyCount) * 100}%` }}
                        />
                        <b>{row.observed}</b>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="news-model-score">
            <h3>Test performance</h3>
            <label>
              Method
              <select
                aria-label="Method"
                value={monthlyMethod}
                onChange={(event) => setMonthlyMethod(event.target.value as MonthlyMethod)}
              >
                {demoMonthly.methods.map(({ id }) => (
                  <option key={id} value={id}>
                    {monthlyMethodNames[id as MonthlyMethod]}
                  </option>
                ))}
              </select>
            </label>
            <dl aria-live="polite" className="news-model-metrics">
              <div>
                <dt>Accuracy</dt>
                <dd>{percent(monthlyScore.accuracy)}</dd>
                <small>{tp + tn} of {demoMonthly.rows.length} decisions correct</small>
              </div>
              <div>
                <dt>Precision</dt>
                <dd>{percent(monthlyScore.precision)}</dd>
                <small>{tp} of {tp + fp} flags matched</small>
              </div>
              <div>
                <dt>Recall</dt>
                <dd>{percent(monthlyScore.recall)}</dd>
                <small>{tp} of {tp + fn} positive district-months caught</small>
              </div>
              <div>
                <dt>Count error</dt>
                <dd>{monthlyScore.mae.toFixed(3)}</dd>
                <small>Mean absolute error</small>
              </div>
              <div>
                <dt>Top 3 capture</dt>
                <dd>{percent(monthlyScore.top_3_events / demoMonthly.rows.reduce((s, r) => s + r.observed, 0))}</dd>
                <small>{monthlyScore.top_3_events} seizures captured</small>
              </div>
            </dl>
          </aside>
        </section>
      )}

      {/* Slide / Ethical Governance Section */}
      <section
        style={{
          marginTop: "2rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "1.25rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Info size={18} style={{ color: "#38bdf8" }} />
          Systemic & Ethical Defense: Accountable Product Design
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", fontSize: "0.85rem", lineHeight: "1.45" }}>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "6px" }}>
            <strong style={{ color: "#38bdf8" }}>1. Feedback Loop Mitigation</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              If police act only on predictions, seizures rise only there, falsely inflating accuracy. Corridor openly acknowledges this and aggregates outputs to districts and transit corridors, never individuals. It serves as an investigative prioritisation aid, not proof of guilt.
            </p>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "6px" }}>
            <strong style={{ color: "#10b981" }}>2. Tip Portal Abuse Defense</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Anonymous community tips are never fed directly to the predictive model or public map. All incoming tips are rate-limited, strictly strip personal allegations, and route to a vetted review queue to prevent neighbor harassment.
            </p>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "6px" }}>
            <strong style={{ color: "#fbbf24" }}>3. Anti-Stigma Protection</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Labeling specific college campuses or local neighborhoods as drug havens causes severe reputational harm. Corridor restricts public views strictly to district-level aggregates and high-level transit corridors.
            </p>
          </div>
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "6px" }}>
            <strong style={{ color: "#a855f7" }}>4. Scraping & Provenance Integrity</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Corridor stores structured fact tuples with exact supporting substrings, never whole copied articles. Every public record provides a direct link to the original published news or agency release.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
