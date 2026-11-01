import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
const count = z.number().finite().nonnegative().max(1e9);
const metrics = z.object({
  mae: count,
  rmse: count,
  rows: count.int().positive(),
  poisson_deviance: count,
  wape: count.nullable(),
});
const forecast = z
  .object({
    entityId: z.string().min(1).max(160),
    name: z.string().min(1).max(200),
    originId: z.string().max(160).nullable(),
    destinationId: z.string().max(160).nullable(),
    areaId: z.string().max(160).nullable(),
    status: z.enum(["forecast", "abstained"]),
    reason: z.string().max(1000).nullable(),
    estimate: count.nullable(),
    baseline: count.nullable(),
    lower: count.nullable(),
    upper: count.nullable(),
    support13w: count.int(),
    coveredWeeks13w: z.number().int().min(0).max(13),
    staleMetrics: z.array(z.string().max(100)).max(10),
  })
  .refine(
    (r) =>
      r.status === "abstained"
        ? r.estimate === null &&
          r.lower === null &&
          r.upper === null &&
          Boolean(r.reason)
        : r.estimate !== null &&
          r.baseline !== null &&
          r.lower !== null &&
          r.upper !== null &&
          r.lower <= r.estimate &&
          r.estimate <= r.upper,
    {
      message:
        "Forecast estimates, ranges or abstention reasons are inconsistent.",
    },
  );

export const modelReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(100),
    synthetic: z.boolean(),
    generatedAt: z.string().max(100),
    asOf: date,
    targetType: z.enum(["area", "corridor"]),
    horizonDays: z.union([z.literal(7), z.literal(28)]),
    target: z.string().min(1).max(500),
    algorithm: z.string().min(1).max(200),
    selectedModel: z.enum(["model", "baseline", "recent_baseline"]),
    selectionReason: z.string().max(1000),
    reportingDelayDays: z.number().int().min(0).max(182),
    trainingRows: count.int().positive(),
    trainingLabelsThrough: date,
    selection: z.object({
      origins: z.array(date).min(1).max(52),
      metrics: z.object({
        model: metrics,
        baseline: metrics,
        recent_baseline: metrics,
      }),
    }),
    calibration: z.object({
      origins: z.array(date).min(1).max(52),
      rows: count.int().positive(),
      nominalCoverage: z.number().min(0).max(1),
      method: z.string().max(1000),
    }),
    holdout: z.object({
      origins: z.array(date).min(1).max(52),
      selected: metrics,
      model: metrics,
      baseline: metrics,
      recentBaseline: metrics,
      intervalCoverage: z.number().min(0).max(1),
      meanIntervalWidth: count,
      folds: z
        .array(
          z.object({
            origin: date,
            end: date,
            train_labels_through: date,
            train_rows: count.int(),
            selected_mae: count,
            model_mae: count,
            baseline_mae: count,
            recent_baseline_mae: count,
            top3_capture: z.number().min(0).max(1).nullable(),
          }),
        )
        .min(1)
        .max(52),
      byEntity: z
        .array(
          z.object({
            entity_id: z.string().max(160),
            name: z.string().max(200),
            mae: count,
            rows: count.int(),
            actual_cases: count.int(),
            interval_coverage: z.number().min(0).max(1),
          }),
        )
        .max(500),
    }),
    featureImportance: z
      .array(
        z.object({
          feature: z.string().max(200),
          mae_increase: z.number().finite(),
          std: count,
        }),
      )
      .max(100),
    data: z.object({
      data_mode: z.enum(["real", "synthetic"]),
      entities: count.int(),
      events: count.int(),
      documented_events: count.int(),
      movement_events: count.int(),
      coverage_weeks: count.int(),
      covariates: count.int(),
      first_event: date.nullable(),
      last_event: date.nullable(),
      input_sha256: z.record(
        z.string().max(100),
        z.string().regex(/^[a-f0-9]{64}$/),
      ),
    }),
    software: z.object({
      pipeline: z.string().max(100),
      python: z.string().max(100),
      sklearn: z.string().max(100),
      numpy: z.string().max(100),
      pandas: z.string().max(100),
    }),
    limitations: z.array(z.string().max(2000)).min(1).max(30),
    forecasts: z.array(forecast).min(1).max(500),
    monitoring: z.object({
      operationallyValidated: z.literal(false),
      alerts: z.array(z.string().max(2000)).max(30),
    }),
    modelSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .superRefine((r, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (r.synthetic !== (r.data.data_mode === "synthetic"))
      issue("Synthetic/real labels disagree.");
    if (new Set(r.forecasts.map((f) => f.entityId)).size !== r.forecasts.length)
      issue("Duplicate forecast entity.");
    if (r.trainingLabelsThrough > r.asOf)
      issue("Training labels extend past the model date.");
    const delay = (r.horizonDays + r.reportingDelayDays) * 86400000;
    if (
      Date.parse(r.selection.origins.at(-1)!) + delay >
      Date.parse(r.calibration.origins[0])
    )
      issue("Selection labels were not mature before calibration.");
    if (
      Date.parse(r.calibration.origins.at(-1)!) + delay >
      Date.parse(r.holdout.origins[0])
    )
      issue("Calibration labels were not mature before holdout.");
    for (const f of r.holdout.folds) {
      if (
        f.train_labels_through > f.origin ||
        Date.parse(f.origin) + delay > Date.parse(r.asOf)
      )
        issue("Invalid chronological holdout.");
    }
  });
export type ModelReport = z.infer<typeof modelReportSchema>;
export function parseModelReport(value: unknown): ModelReport {
  const parsed = modelReportSchema.safeParse(value);
  if (!parsed.success)
    throw Error(
      `Choose report.json from a completed training run. ${parsed.error.issues[0]?.message ?? "Invalid report."}`,
    );
  return parsed.data;
}
