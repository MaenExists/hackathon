import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forecast,
  backtest,
  eligible,
  tokenSimilarity,
} from "../lib/analysis.ts";
import type { CaseRecord } from "../lib/types.ts";
const row = (
  id: string,
  eventDate: string,
  availableDate = eventDate,
  status = "documented",
  corridorId: string | null = "c01",
) => ({ id, eventDate, availableDate, status, corridorId }) as CaseRecord;
test("forecast excludes future, late-arriving, disputed and seizure-only records", () => {
  const data = [
    row("ok", "2026-10-15"),
    row("future", "2026-11-02"),
    row("late", "2026-10-15", "2026-11-02"),
    row("disputed", "2026-10-15", "2026-10-16", "disputed"),
    row("point", "2026-10-15", "2026-10-16", "documented", null),
  ];
  assert.deepEqual(
    eligible(data, "2026-11-01").map((r) => r.id),
    ["ok"],
  );
  assert.equal(forecast(data, ["c01"])[0].estimate, 0.6);
});
test("baseline is independent 90-day monthly mean and weighted model has explicit bins", () => {
  const result = forecast(
    [row("a", "2026-10-10"), row("b", "2026-09-10"), row("c", "2026-08-10")],
    ["c01"],
  )[0];
  assert.equal(result.estimate, 1);
  assert.equal(result.baseline, 1);
});
test("cutoff day is held out; records available only later do not leak into training", () => {
  assert.equal(
    forecast(
      [row("x", "2026-05-01"), row("y", "2026-04-20", "2026-05-02")],
      ["c01"],
      "2026-05-01",
    )[0].support,
    0,
  );
  const folds = backtest([row("a", "2026-05-05")], ["c01"]);
  assert.equal(folds.length, 6);
  assert.equal(folds[0].total, 1);
  assert.equal(folds[0].modelMae, 1);
});
test("duplicate similarity normalizes punctuation and does not imply corroboration", () => {
  assert.equal(
    tokenSimilarity("Parcel transfer, evening", "evening parcel transfer!"),
    1,
  );
  assert.equal(tokenSimilarity("parcel route", "unrelated information"), 0);
});
test("records reviewed after the prediction cutoff are excluded", () => {
  const r = { ...row("late-review", "2026-04-10"), reviewedAt: "2026-05-04" };
  assert.equal(forecast([r], ["c01"], "2026-05-01")[0].support, 0);
});
