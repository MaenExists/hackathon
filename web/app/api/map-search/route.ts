import { env } from "cloudflare:workers";
import { access, db, json, failure } from "../../../lib/server";
import { searchMap, MapSearchError } from "../../../lib/map-search";
export async function GET(request: Request) {
  try {
    await access();
    const params = new URL(request.url).searchParams;
    const config = env as typeof env & { PHOTON_BASE_URL?: string };
    return json(
      await searchMap(
        { db: db(), baseUrl: config.PHOTON_BASE_URL },
        params.get("q") ?? "",
        params.get("scope") ?? "kerala",
        params.get("category") ?? "all",
      ),
    );
  } catch (error) {
    if (error instanceof MapSearchError) {
      const res = json({ error: error.message }, error.status);
      if (error.status === 429) res.headers.set("Retry-After", "2");
      return res;
    }
    return failure(error);
  }
}
