import { briefSchema } from "../../../lib/validation";
import {
  access,
  records,
  body,
  db,
  json,
  failure,
  sameOrigin,
  HttpError,
} from "../../../lib/server";
import { corridorName, corridors } from "../../../data/geography";
import { limitations, DEMO_AS_OF } from "../../../lib/analysis";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await access();
    const parsed = briefSchema.safeParse(await body(req));
    if (!parsed.success)
      return json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        400,
      );
    const b = parsed.data;
    if (user.role === "planner" && b.audience === "enforcement")
      throw new HttpError(
        403,
        "Planner role can prepare prevention or health summaries.",
      );
    const data = (await records(user.userId)).filter(
      (r) => r.status === "documented" && r.availableDate <= DEMO_AS_OF,
    );
    const summaries = corridors
      .map((c) => ({
        name: corridorName(c.id),
        count: data.filter((r) => r.corridorId === c.id).length,
      }))
      .filter((c) => c.count >= 5)
      .sort((a, b) => b.count - a.count);
    const content = [
      `# ${b.title}`,
      "",
      "Synthetic demonstration · Draft for human review",
      `Audience: ${b.audience} | Evidence snapshot: ${DEMO_AS_OF}`,
      "",
      "## Aggregate documented connections",
      ...summaries.map((s) => `- ${s.name}: ${s.count} fictional records`),
      "",
      "Groups below five records are suppressed. This demonstration threshold requires agency and privacy review before operational use. No names, source identities, raw tips, source excerpts or record IDs are included.",
      "",
      b.audience === "health"
        ? "Planning question: What independently established treatment needs, existing capacity, waiting times and access barriers should health planners review? Case counts do not estimate demand for care."
        : b.audience === "prevention"
          ? "Planning question: What independently established outreach needs and existing local programmes should prevention coordinators review? Corridor proximity does not establish activity at schools."
          : "Planning question: Which aggregate connections warrant a closer evidence and coverage review by authorized analysts? This draft does not authorize enforcement action.",
      "",
      "## Analyst note",
      b.note || "No additional note.",
      "",
      "## What this cannot tell you",
      ...limitations.map((l) => `- ${l}`),
    ].join("\n");
    const id = crypto.randomUUID(),
      createdAt = new Date().toISOString();
    await db()
      .prepare(
        "INSERT INTO briefs (id,owner_id,title,audience,content,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, user.userId, b.title, b.audience, content, createdAt)
      .run();
    return json(
      { id, title: b.title, audience: b.audience, content, createdAt },
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
