import { body, db, json, failure, sameOrigin } from "../../../lib/server";
import { tipSchema } from "../../../lib/validation";
import { tokenSimilarity } from "../../../lib/analysis";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = tipSchema.safeParse(await body(req));
    if (!parsed.success)
      return json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        400,
      );
    const t = parsed.data,
      now = new Date().toISOString();
    const count = await db()
      .prepare(
        "SELECT COUNT(*) AS n FROM tips WHERE julianday(created_at) > julianday('now','-1 hour')",
      )
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= 30)
      return json(
        {
          error:
            "The demonstration intake is temporarily full. Try again in one hour.",
        },
        429,
      );
    const candidates = await db()
      .prepare(
        "SELECT id,narrative,duplicate_group FROM tips WHERE district = ? AND julianday(created_at) > julianday('now','-30 days')",
      )
      .bind(t.district)
      .all<{ id: string; narrative: string; duplicate_group: string | null }>();
    const match = candidates.results.find(
      (r) => tokenSimilarity(t.narrative, r.narrative) >= 0.55,
    );
    const group = match ? (match.duplicate_group ?? match.id) : null;
    const id = `TIP-${crypto.randomUUID()}`;
    const writes = [
      db()
        .prepare(
          "INSERT INTO tips (id,district,narrative,contact,created_at,duplicate_group,synthetic) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          t.district,
          t.narrative,
          t.contact || null,
          now,
          group,
          "true",
        ),
    ];
    if (match && !match.duplicate_group)
      writes.push(
        db()
          .prepare("UPDATE tips SET duplicate_group = ? WHERE id = ?")
          .bind(group, match.id),
      );
    await db().batch(writes);
    return json(
      {
        id,
        status: "unreviewed",
        message:
          "Saved privately in the demonstration. No report has been sent to any authority.",
      },
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
