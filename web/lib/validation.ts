import { z } from "zod";
import { places, corridors } from "../data/geography";
export const sessionSchema = z
  .object({ role: z.enum(["analyst", "planner"]) })
  .strict();
export const briefSchema = z
  .object({
    title: z.string().trim().min(5).max(150),
    audience: z.enum(["enforcement", "prevention", "health"]),
    note: z.string().trim().max(2000),
  })
  .strict();
const place = z
  .string()
  .refine((v) => places.some((p) => p.id === v), "Unknown district");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
export const caseSchema = z
  .object({
    id: z.string().regex(/^SYN-[A-Z0-9-]{1,40}$/),
    corridorId: z
      .string()
      .nullable()
      .refine(
        (v) => v === null || corridors.some((c) => c.id === v),
        "Unknown corridor",
      ),
    seizurePlace: place,
    eventDate: day,
    availableDate: day,
    sourceDate: day,
    substance: z.enum(["Cannabis", "Stimulants", "Opioids", "Other"]),
    quantity: z.number().nonnegative().max(1e8).nullable(),
    unit: z.enum(["kg", "g", "unknown"]),
    status: z.literal("unreviewed"),
    precision: z.literal("district"),
    source: z.string().min(5).max(200),
    excerpt: z.string().min(20).max(4000),
    reviewer: z.null(),
    reviewedAt: z.null(),
    confidence: z.literal("unknown"),
    confidenceBasis: z.string().min(10).max(1000),
    synthetic: z.literal(true),
  })
  .strict()
  .refine(
    (r) => r.availableDate >= r.eventDate,
    "Availability must not precede event date",
  )
  .refine(
    (r) => r.sourceDate <= r.availableDate,
    "Source must exist when made available",
  );
export const importSchema = z
  .array(caseSchema)
  .min(1)
  .max(100)
  .refine(
    (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
    "Duplicate IDs in upload",
  );
export const tipSchema = z
  .object({
    district: place,
    narrative: z.string().trim().min(30).max(3000),
    contact: z.string().trim().max(200).optional(),
    synthetic: z.literal(true),
  })
  .strict();
export const reviewSchema = z
  .object({
    entityId: z.string().min(1).max(80),
    entityType: z.enum(["case", "tip"]),
    status: z.enum([
      "documented",
      "unreviewed",
      "disputed",
      "triaged",
      "dismissed",
      "corroborated",
    ]),
    note: z.string().trim().min(20).max(2000),
    evidenceId: z.string().max(80).nullable().optional(),
    independent: z.boolean().optional(),
  })
  .strict();
