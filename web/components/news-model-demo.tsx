"use client";

import { useState } from "react";
import demo from "../data/news-demo.json";

type Method = keyof (typeof demo.rows)[number]["expected"];
const methodNames: Record<Method, string> = {
  district_history: "Historical district average",
  district_recent_3m: "Recent three-month average",
  poisson_district_calendar: "Poisson model",
};
const selectedMethod = demo.selected as Method;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const monthName = (month: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
const maxCount = Math.max(
  ...demo.rows.flatMap((row) => [row.observed, ...Object.values(row.expected)]),
);
const holdoutObservations = demo.rows.reduce(
  (sum, row) => sum + row.observed,
  0,
);

export default function NewsModelDemo() {
  const [month, setMonth] = useState(demo.months[0]);
  const [method, setMethod] = useState<Method>(selectedMethod);
  const score = demo.methods.find((item) => item.id === method)!;
  const selected = demo.methods.find((item) => item.id === selectedMethod)!;
  const { tp, fp, fn, tn } = score.confusion;
  const rows = demo.rows
    .filter((row) => row.month === month)
    .sort(
      (a, b) =>
        b.expected[method] - a.expected[method] ||
        a.district.localeCompare(b.district),
    );

  return (
    <div className="news-model" data-testid="news-model">
      <div className="news-model-context">
        <div>
          <h2>How close were the predictions?</h2>
          <p>
            Corridor estimates how many seizure observations our news collection
            will show in each district per month. We fitted the methods on
            earlier months and tested them on {demo.rows.length} later
            district-months across Kerala.
          </p>
        </div>
        <p className="news-model-selection">
          <strong>Selected for v1</strong>
          <span>{methodNames[selectedMethod]}</span>
          <small>
            Lowest validation error, {selected.validationMae.toFixed(3)} reports
            per district-month.
          </small>
        </p>
      </div>

      <section
        className="news-model-grid"
        aria-label="Holdout replay and performance"
      >
        <div className="news-model-replay">
          <div className="news-model-replay-head">
            <div>
              <h3>Holdout replay</h3>
              <p>June–October 2026</p>
            </div>
            <label>
              Test month
              <select
                aria-label="Test month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                {demo.months.map((value) => (
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
            <caption className="sr-only">
              Predicted and observed counts for {monthName(month)}
            </caption>
            <thead>
              <tr>
                <th scope="col">District</th>
                <th scope="col">Predicted</th>
                <th scope="col">Observed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.district}>
                  <th scope="row">{row.district}</th>
                  <td>
                    <div className="news-model-bar">
                      <span
                        style={{
                          width: `${(row.expected[method] / maxCount) * 100}%`,
                        }}
                        aria-hidden="true"
                      />
                      <b>{row.expected[method].toFixed(2)}</b>
                    </div>
                  </td>
                  <td>
                    <div className="news-model-bar observed">
                      <span
                        style={{ width: `${(row.observed / maxCount) * 100}%` }}
                        aria-hidden="true"
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
              value={method}
              onChange={(event) => setMethod(event.target.value as Method)}
            >
              {demo.methods.map(({ id }) => (
                <option key={id} value={id}>
                  {methodNames[id as Method]}
                </option>
              ))}
            </select>
          </label>
          <p>
            Scores use all five test months. A flag means at least a{" "}
            {percent(demo.threshold)} model probability of one or more collected
            reports.
          </p>
          <dl aria-live="polite" className="news-model-metrics">
            <div>
              <dt>Accuracy</dt>
              <dd>{percent(score.accuracy)}</dd>
              <small>
                {tp + tn} of {demo.rows.length} decisions correct
              </small>
            </div>
            <div>
              <dt>Precision</dt>
              <dd>{percent(score.precision)}</dd>
              <small>
                {tp} of {tp + fp} flags matched
              </small>
            </div>
            <div>
              <dt>Recall</dt>
              <dd>{percent(score.recall)}</dd>
              <small>
                {tp} of {tp + fn} positive district-months caught
              </small>
            </div>
            <div>
              <dt>F1</dt>
              <dd>{percent(score.f1)}</dd>
              <small>Balance of precision and recall</small>
            </div>
            <div>
              <dt>Count error</dt>
              <dd>{score.mae.toFixed(3)}</dd>
              <small>Mean absolute error per district-month</small>
            </div>
            <div>
              <dt>Top 3 capture</dt>
              <dd>{percent(score.top_3_events / holdoutObservations)}</dd>
              <small>
                {score.top_3_events} of {holdoutObservations} observations
              </small>
            </div>
          </dl>
          <p>
            {fp} false flags and {fn} missed district-months.
          </p>
        </aside>
      </section>

      <section className="news-model-methods">
        <h3>Why this method won</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Validation count error</th>
                <th scope="col">Test count error</th>
              </tr>
            </thead>
            <tbody>
              {demo.methods.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    {methodNames[item.id as Method]}
                    {item.id === selectedMethod && <small>Selected</small>}
                  </th>
                  <td>{item.validationMae.toFixed(3)}</td>
                  <td>{item.mae.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We chose the method on January–May 2026 validation error. The recent
          average scored slightly better on test count error and missed more
          district-months with reports.
        </p>
      </section>
      <details className="news-model-methods">
        <summary>Data, dates and limitations</summary>
        <p>
          {demo.inputObservations.toLocaleString()} canonical observations
          entered filtering. {demo.eligibleObservations} dated seizures
          qualified and {demo.fitEvents} were available by publication date for
          the final fit through May 2026. The test block contained{" "}
          {holdoutObservations} observations.
        </p>
        <p>
          Zero means zero eligible observations in the collection. Publication
          dates approximate past availability. Seizure totals and movements need
          independent outcomes and reporting coverage.
        </p>
        <p>
          Run {demo.version}. Model SHA-256 <code>{demo.modelSha256}</code>
        </p>
      </details>
    </div>
  );
}
