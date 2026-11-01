import { sessionSchema } from "../../../lib/validation";
import {
  access,
  body,
  json,
  failure,
  sameOrigin,
  HttpError,
} from "../../../lib/server";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await access();
    const parsed = sessionSchema.safeParse(await body(req));
    if (!parsed.success)
      return json({ error: "Choose an analyst or planner role." }, 400);
    const data = parsed.data;
    const res = json({ role: data.role });
    res.headers.set(
      "Set-Cookie",
      `corridor-demo-role=${data.role}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
    );
    return res;
  } catch (e) {
    return failure(e);
  }
}
