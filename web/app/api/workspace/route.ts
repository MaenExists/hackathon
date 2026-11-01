import {
  access,
  records,
  reviewHistory,
  tipList,
  json,
  failure,
  frozenRecords,
  db,
} from "../../../lib/server";
import {
  forecast,
  backtest,
  limitations,
  DEMO_AS_OF,
} from "../../../lib/analysis";
import { corridors } from "../../../data/geography";
export async function GET() {
  try {
    const user = await access();
    const data = await records(user.userId);
    const ids = corridors.map((c) => c.id);
    const forecasts = forecast(frozenRecords, ids),
      evaluation = backtest(frozenRecords, ids);
    const aggregates = corridors.map((c) => ({
      corridorId: c.id,
      count: data.filter(
        (r) => r.corridorId === c.id && r.availableDate <= DEMO_AS_OF,
      ).length,
      reviewed: data.filter(
        (r) =>
          r.corridorId === c.id &&
          r.status === "documented" &&
          r.availableDate <= DEMO_AS_OF,
      ).length,
    }));
    const saved = await db()
      .prepare(
        "SELECT id,title,audience,content,created_at AS createdAt FROM briefs WHERE owner_id = ? ORDER BY created_at DESC",
      )
      .bind(user.userId)
      .all();
    return json({
      user: { displayName: user.displayName, role: user.role },
      asOf: DEMO_AS_OF,
      synthetic: true,
      records: user.role === "analyst" ? data : [],
      reviews: user.role === "analyst" ? await reviewHistory(user.userId) : [],
      tips: user.role === "analyst" ? await tipList(user.userId) : [],
      aggregates: aggregates
        .filter((a) => (user.role === "analyst" ? a.count : a.reviewed) >= 5)
        .map((a) =>
          user.role === "analyst"
            ? { ...a, reviewed: a.reviewed >= 5 ? a.reviewed : null }
            : {
                corridorId: a.corridorId,
                count: a.reviewed,
                reviewed: a.reviewed,
              },
        ),
      forecast: forecasts.filter(
        (f) =>
          user.role === "analyst" ||
          (f.recent >= 5 &&
            f.previous >= 5 &&
            Math.round(f.baseline * 3) - f.recent - f.previous >= 5),
      ),
      evaluation,
      limitations,
      briefs: saved.results.filter(
        (b) => user.role === "analyst" || b.audience !== "enforcement",
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
