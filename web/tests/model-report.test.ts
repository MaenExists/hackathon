import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseModelReport } from "../lib/model-report.ts";
const fixture = (target: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../data/model-${target}.json`, import.meta.url),
      "utf8",
    ),
  );

test("trained synthetic reports have mature stages and valid count ranges", () => {
  for (const target of ["corridor", "area"]) {
    const report = parseModelReport(fixture(target));
    assert.equal(report.synthetic, true);
    assert.equal(report.targetType, target);
    assert.equal(report.monitoring.operationallyValidated, false);
    assert(report.forecasts.some((r) => r.status === "forecast"));
  }
});
test("local reports reject invalid ranges, future labels and inconsistent provenance", () => {
  const bad = fixture("corridor");
  bad.forecasts[0].lower = 99999999;
  assert.throws(() => parseModelReport(bad));
  const future = fixture("corridor");
  future.trainingLabelsThrough = "2099-01-01";
  assert.throws(() => parseModelReport(future));
  const leak = fixture("corridor");
  leak.calibration.origins[leak.calibration.origins.length - 1] =
    leak.holdout.origins[0];
  assert.throws(() => parseModelReport(leak));
  const mismatch = fixture("corridor");
  mismatch.synthetic = false;
  assert.throws(() => parseModelReport(mismatch));
});
test("aggregate report parsing strips unrelated record payloads before local rendering/export", () => {
  const value = fixture("area");
  value.privateRecords = [{ narrative: "This is an unrelated test payload" }];
  value.data.extra = "not an aggregate field";
  const report = parseModelReport(value);
  assert.equal("privateRecords" in report, false);
  assert.equal("extra" in report.data, false);
});
