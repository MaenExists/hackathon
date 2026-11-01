"use client";
import { useRef, useState } from "react";
import {
  BrainCircuit,
  Download,
  FileJson,
  Info,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { parseModelReport, type ModelReport } from "../lib/model-report";
import corridorReport from "../data/model-corridor.json";
import areaReport from "../data/model-area.json";

const builtIns = {
  corridor: parseModelReport(corridorReport),
  area: parseModelReport(areaReport),
};
const method = {
  model: "Poisson gradient boosting",
  baseline: "13-week covered mean",
  recent_baseline: "4-week covered mean",
};
const fmt = (n: number | null, digits = 2) =>
  n === null
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: digits });

export default function ModelLab({ analyst }: { analyst: boolean }) {
  const [report, setReport] = useState<ModelReport>(builtIns.corridor);
  const [local, setLocal] = useState(false),
    [error, setError] = useState("");
  const [inspect, setInspect] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const selected = report.forecasts.find((r) => r.entityId === inspect);
  const max = Math.max(...report.forecasts.map((r) => r.upper ?? 0), 1);
  const name = method[report.selectedModel];
  const end = new Date(Date.parse(report.asOf) + report.horizonDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const switchReport = (target: "corridor" | "area") => {
    setReport(builtIns[target]);
    setLocal(false);
    setInspect(null);
    setError("");
  };
  async function readFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw Error(
          "Aggregate reports must be under 1 MB. Select report.json, not raw records or a model binary.",
        );
      const parsed = parseModelReport(JSON.parse(await file.text()));
      setReport(parsed);
      setLocal(true);
      setInspect(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-report-${report.runId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="model-lab" data-testid="model-lab">
      <section className="model-control-panel">
        <div className="model-eyebrow">
          <BrainCircuit size={14} /> TRAINABLE PIPELINE{" "}
          <span>
            {local
              ? "LOCAL JSON · SOURCE UNVERIFIED"
              : "SYNTHETIC TRAINING RUN"}
          </span>
        </div>
        <div className="model-toolbar">
          <div>
            <h2>A model you can train.</h2>
            <p>
              Inspect learned forecasts, coverage and errors before trusting a
              pattern.
            </p>
          </div>
          <div className="model-actions">
            <button
              onClick={() => switchReport("corridor")}
              aria-pressed={!local && report.targetType === "corridor"}
            >
              Corridor model
            </button>
            <button
              onClick={() => switchReport("area")}
              aria-pressed={!local && report.targetType === "area"}
            >
              Area model
            </button>
            {analyst && (
              <>
                <input
                  ref={upload}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Open local model report"
                  className="sr-only"
                  onChange={(e) => {
                    void readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button onClick={() => upload.current?.click()}>
                  <Upload size={12} /> Open local report
                </button>
              </>
            )}
            <button
              onClick={download}
              aria-label="Download aggregate model report"
            >
              <Download size={12} />
            </button>
          </div>
        </div>
        {error && (
          <p className="model-error" role="alert">
            {error}
          </p>
        )}
        <p className="model-origin-note">
          {local
            ? "Selected JSON stays in this tab. It is not uploaded, saved to the server, or verified as an authentic training run."
            : "This independent three-year simulation exercises the Python pipeline. Its counts are separate from the atlas’s original case scenario."}{" "}
          {report.synthetic
            ? "All records in this report are invented."
            : "Real-data experiment · operational validation is not established."}
        </p>
        <div className="model-identity">
          <span>
            <FileJson size={12} /> {report.runId}
          </span>
          <span>
            {report.targetType} · {report.horizonDays}-day target
          </span>
          <span>As of {report.asOf}</span>
          <span>{report.trainingRows.toLocaleString()} training windows</span>
        </div>
      </section>
      <div className="evaluation-summary trained-model-metrics">
        <div>
          <small>Selected method · holdout MAE</small>
          <strong>
            {fmt(report.holdout.selected.mae)}{" "}
            <span>cases / {report.targetType}</span>
          </strong>
          <p>{name}</p>
        </div>
        <div>
          <small>13-week baseline · holdout MAE</small>
          <strong>
            {fmt(report.holdout.baseline.mae)}{" "}
            <span>cases / {report.targetType}</span>
          </strong>
          <p>Same unseen periods</p>
        </div>
        <div>
          <small>Observed range coverage</small>
          <strong>
            {fmt(report.holdout.intervalCoverage * 100, 1)}
            <span>% of held-out counts</span>
          </strong>
          <p>90% nominal · no guarantee</p>
        </div>
        <div>
          <small>Known reporting universe</small>
          <strong>
            {report.data.entities} <span>registered entities</span>
          </strong>
          <p>
            {report.data.events.toLocaleString()} cases ·{" "}
            {report.data.coverage_weeks.toLocaleString()} coverage releases
          </p>
        </div>
      </div>
      {Boolean(report.monitoring.alerts.length) && (
        <div className="model-alerts" role="status">
          {report.monitoring.alerts.map((a, i) => (
            <p key={i}>
              <Info size={12} />
              {a}
            </p>
          ))}
        </div>
      )}
      <div className="model-forecast-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Learned forecast ·{" "}
                {report.targetType === "corridor"
                  ? "documented connections"
                  : "seizure areas"}
              </h2>
              <small>
                {report.asOf} → {end} · expected documented cases
              </small>
            </div>
            <span className="model-range-key">
              <i /> Empirical range
            </span>
          </div>
          <div className="table-wrap">
            <table className="learned-forecast-table">
              <thead>
                <tr>
                  <th>
                    {report.targetType === "corridor" ? "Connection" : "Area"}
                  </th>
                  <th>Expected cases & range</th>
                  <th>13-week baseline</th>
                </tr>
              </thead>
              <tbody>
                {report.forecasts.map((r) => (
                  <tr
                    key={r.entityId}
                    className={
                      inspect === r.entityId ? "model-selected-row" : ""
                    }
                  >
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setInspect(r.entityId)}
                      >
                        {r.name}
                      </button>
                      <small>
                        {r.status === "abstained"
                          ? "Abstained · inspect reason"
                          : `${r.coveredWeeks13w}/13 covered weeks`}
                      </small>
                    </td>
                    <td>
                      {r.status === "forecast" ? (
                        <>
                          <div
                            className="model-range-track"
                            aria-label={`${r.name}: estimate ${r.estimate}, range ${r.lower} to ${r.upper}`}
                          >
                            <span
                              style={{
                                left: `${(r.lower! / max) * 100}%`,
                                width: `${((r.upper! - r.lower!) / max) * 100}%`,
                              }}
                            />
                            <i
                              style={{ left: `${(r.estimate! / max) * 100}%` }}
                            />
                          </div>
                          <small>
                            <b>{fmt(r.estimate, 1)}</b>{" "}
                            <span className="muted">
                              [{r.lower}–{r.upper}]
                            </span>
                          </small>
                        </>
                      ) : (
                        <span className="amber-text">Insufficient support</span>
                      )}
                    </td>
                    <td>{fmt(r.baseline, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-footnote">
            Ranges describe count uncertainty. An abstention is missing support,
            not a forecast of zero. Select a row to inspect its coverage.
          </p>
        </section>
        <aside className="model-inspector">
          <ShieldCheck size={20} />
          <h2>{selected ? selected.name : "Inspect the basis."}</h2>
          {selected ? (
            <>
              <p>
                {selected.reason ??
                  `${fmt(selected.estimate, 1)} expected documented cases over ${report.horizonDays} days; empirical range ${selected.lower}–${selected.upper}.`}
              </p>
              <dl>
                <div>
                  <dt>Recent documented cases</dt>
                  <dd>{selected.support13w} / 13 weeks</dd>
                </div>
                <div>
                  <dt>Complete reporting weeks</dt>
                  <dd>{selected.coveredWeeks13w} / 13</dd>
                </div>
                <div>
                  <dt>Selected method</dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>Stale context fields</dt>
                  <dd>{selected.staleMetrics.join(", ") || "None reported"}</dd>
                </div>
              </dl>
              <p>
                Original records and input hashes remain in the local training
                run. This aggregate report contains no case narrative.
              </p>
            </>
          ) : (
            <p>
              The pipeline uses only information available at each forecast
              date, compares two baselines, and abstains when an entity lacks
              enough documented history or reporting coverage.
            </p>
          )}
          <h3>What this cannot tell you</h3>
          {report.limitations.slice(0, 4).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </aside>
      </div>
      <section className="panel model-validation-panel">
        <div className="panel-heading">
          <h2>Three stages. One untouched holdout.</h2>
          <span>No shuffled time split</span>
        </div>
        <div className="model-stages">
          <div>
            <small>01 / SELECT</small>
            <h3>Model vs two baselines</h3>
            <p>
              {report.selection.origins[0]} → {report.selection.origins.at(-1)}
            </p>
            <p>
              Candidate MAE {fmt(report.selection.metrics.model.mae)} · 13-week{" "}
              {fmt(report.selection.metrics.baseline.mae)} · 4-week{" "}
              {fmt(report.selection.metrics.recent_baseline.mae)}
            </p>
          </div>
          <div>
            <small>02 / CALIBRATE</small>
            <h3>Learn error ranges</h3>
            <p>
              {report.calibration.origins[0]} →{" "}
              {report.calibration.origins.at(-1)}
            </p>
            <p>
              {report.calibration.rows} earlier predictions; ranges fixed before
              holdout.
            </p>
          </div>
          <div>
            <small>03 / HOLD OUT</small>
            <h3>Measure unseen error</h3>
            <p>
              {report.holdout.origins[0]} → {report.holdout.origins.at(-1)}
            </p>
            <p>
              {report.holdout.selected.rows} predictions; mean range width{" "}
              {fmt(report.holdout.meanIntervalWidth, 1)} cases.
            </p>
          </div>
        </div>
        <p className="table-footnote">
          {report.selectionReason} Origins are separated by the target horizon
          plus a {report.reportingDelayDays}-day reporting delay.
        </p>
        <details>
          <summary>Inspect chronological folds and area errors</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prediction date</th>
                  <th>Training labels mature through</th>
                  <th>Selected MAE</th>
                  <th>Candidate MAE</th>
                  <th>13-week MAE</th>
                  <th>4-week MAE</th>
                </tr>
              </thead>
              <tbody>
                {report.holdout.folds.map((f) => (
                  <tr key={f.origin}>
                    <td>{f.origin}</td>
                    <td>{f.train_labels_through}</td>
                    <td>{fmt(f.selected_mae)}</td>
                    <td>{fmt(f.model_mae)}</td>
                    <td>{fmt(f.baseline_mae)}</td>
                    <td>{fmt(f.recent_baseline_mae)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>MAE</th>
                  <th>Held-out counts</th>
                  <th>Range coverage</th>
                </tr>
              </thead>
              <tbody>
                {report.holdout.byEntity.map((r) => (
                  <tr key={r.entity_id}>
                    <td>{r.name}</td>
                    <td>{fmt(r.mae)}</td>
                    <td>{r.actual_cases}</td>
                    <td>{fmt(r.interval_coverage * 100, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details>
          <summary>Inspect model sensitivity and reproducibility</summary>
          <p>
            Permutation sensitivity measures predictive associations, not
            causes. Negative values can reflect noise. It does not determine the
            selected method.
          </p>
          <div className="model-feature-list">
            {report.featureImportance.map((f) => (
              <div key={f.feature}>
                <code>{f.feature}</code>
                <span>
                  {f.mae_increase > 0 ? "+" : ""}
                  {fmt(f.mae_increase, 3)} MAE when shuffled
                </span>
              </div>
            ))}
          </div>
          <p>
            Pipeline {report.software.pipeline} · scikit-learn{" "}
            {report.software.sklearn} · Python {report.software.python}
          </p>
          <p>
            Model SHA-256{" "}
            <code className="model-hash">
              {report.modelSha256 ?? "Not supplied"}
            </code>
          </p>
          {Object.entries(report.data.input_sha256).map(([file, hash]) => (
            <p key={file}>
              {file} <code className="model-hash">{hash}</code>
            </p>
          ))}
        </details>
      </section>
      <section className="model-start-guide">
        <div>
          <BrainCircuit size={20} />
          <h2>Bring the evidence. Train the next run.</h2>
          <p>
            Use the Python pipeline and collection templates in the repository’s{" "}
            <code>ml/</code> directory. Real source files and model binaries
            stay local; open a completed aggregate <code>report.json</code>{" "}
            here.
          </p>
        </div>
        <ol>
          <li>
            <b>Prepare</b>
            <span>
              Canonical cases, documented dates, known areas/corridors and
              weekly reporting coverage.
            </span>
          </li>
          <li>
            <b>Validate & train</b>
            <span>
              Run the area model first if movement endpoints are unknown. Train
              into a new versioned run.
            </span>
          </li>
          <li>
            <b>Review & monitor</b>
            <span>
              Inspect baselines, held-out errors and coverage. Score the
              forecast when outcomes mature.
            </span>
          </li>
        </ol>
        <p>
          Consumption is optional aggregate context. News remains a separate
          review inbox; neither raw articles nor community tips trigger
          learning.
        </p>
      </section>
    </div>
  );
}
