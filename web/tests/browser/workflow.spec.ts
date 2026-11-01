import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const sample = JSON.parse(
  readFileSync(
    new URL("../../public/sample-import.json", import.meta.url),
    "utf8",
  ),
)[0];
test("private records, import, review, duplicates, briefs and server-enforced planner view", async ({
  page,
  browser,
}) => {
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(
    "http://127.0.0.1:5173/api/workspace",
  );
  expect(denied.status()).toBe(401);
  const lead = {
    district: "ernakulam",
    narrative: `Fictional test exercise: evening parcel movements at the imaginary interchange alpha ${Date.now()}. No people or real businesses.`,
    synthetic: true,
  };
  const first = await anonymous.request.post("http://127.0.0.1:5173/api/tips", {
    data: lead,
  });
  expect(first.status()).toBe(201);
  const id = (await first.json()).id;
  const duplicate = await anonymous.request.post(
    "http://127.0.0.1:5173/api/tips",
    { data: lead },
  );
  expect(duplicate.status()).toBe(201);
  const origin = await anonymous.request.post(
    "http://127.0.0.1:5173/api/tips",
    { data: lead, headers: { Origin: "https://untrusted.invalid" } },
  );
  expect(origin.status()).toBe(403);
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  const initial = await (await page.request.get("/api/workspace")).json();
  expect(initial.records.length).toBeGreaterThan(700);
  expect(
    initial.tips.find((t: { id: string }) => t.id === id).duplicateGroup,
  ).toBeTruthy();
  const upload = { ...sample, id: `SYN-E2E-${Date.now()}` };
  const imported = await page.request.post("/api/records", { data: [upload] });
  expect(imported.status()).toBe(201);
  expect(
    (await page.request.post("/api/records", { data: [upload] })).status(),
  ).toBe(409);
  const invalid = await page.request.post("/api/records", {
    data: [{ ...upload, id: "SYN-INVALID", eventDate: "2026-02-31" }],
  });
  expect(invalid.status()).toBe(400);
  const provenance = initial.records.find(
    (r: { corridorId: string; status: string }) =>
      r.corridorId === upload.corridorId && r.status === "documented",
  );
  const refused = await page.request.post("/api/reviews", {
    data: {
      entityId: upload.id,
      entityType: "case",
      status: "documented",
      note: "Source independence has not been established.",
    },
  });
  expect(refused.status()).toBe(400);
  const reviewed = await page.request.post("/api/reviews", {
    data: {
      entityId: upload.id,
      entityType: "case",
      status: "documented",
      note: "Independent fictional transport source reviewed and linked at district resolution.",
      evidenceId: provenance.id,
      independent: true,
    },
  });
  expect(reviewed.status()).toBe(201);
  const leadReview = await page.request.post("/api/reviews", {
    data: {
      entityId: id,
      entityType: "tip",
      status: "triaged",
      note: "Possible repeated exercise. Requires independent source review before corroboration.",
    },
  });
  expect(leadReview.status()).toBe(201);
  const updated = await (await page.request.get("/api/workspace")).json();
  expect(
    updated.records.find((r: { id: string }) => r.id === upload.id).status,
  ).toBe("documented");
  expect(updated.forecast).toEqual(initial.forecast);
  const brief = await page.request.post("/api/briefs", {
    data: {
      title: "Synthetic prevention planning exercise",
      audience: "prevention",
      note: "Review independent local outreach needs before considering programme changes.",
    },
  });
  expect(brief.status()).toBe(201);
  const document = await brief.json();
  expect(document.content).toContain("What this cannot tell you");
  expect(document.content).not.toMatch(/SYN-\d|TIP-/);
  await page.request.post("/api/session", { data: { role: "planner" } });
  const planner = await (await page.request.get("/api/workspace")).json();
  expect(planner.records).toEqual([]);
  expect(planner.tips).toEqual([]);
  expect(planner.reviews).toEqual([]);
  expect(
    (await page.request.post("/api/records", { data: [upload] })).status(),
  ).toBe(403);
  expect((await page.request.post("/api/reviews", { data: {} })).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.post("/api/briefs", {
        data: {
          title: "Restricted enforcement",
          audience: "enforcement",
          note: "",
        },
      })
    ).status(),
  ).toBe(403);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Evidence library", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Switch role" }).click();
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  await anonymous.close();
});
test("analyst UI, offline boundaries, evidence modal, forecast, saved brief and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1512, height: 1100 });
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  await expect(page.locator(".atlas > g > path").first()).toBeVisible();
  expect((await page.request.get("/data/kerala.geojson")).status()).toBe(200);
  await page.screenshot({
    path: "outputs/corridor-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Substance", { exact: true }).selectOption("Opioids");
  await expect(page.locator(".evidence-card").first()).toContainText("Opioids");
  await page.getByLabel("Substance", { exact: true }).selectOption("all");
  await page.locator(".evidence-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source reference", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Available to analyst", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Forecast lab", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A hypothesis to investigate." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What this cannot tell you",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(16);
  await page
    .getByRole("button", { name: "Planning briefs", exact: true })
    .click();
  await page.getByRole("button", { name: "Generate aggregate draft" }).click();
  await expect(page.locator(".brief-preview pre")).toContainText(
    "Synthetic demonstration",
  );
  await expect(
    page.getByRole("button", { name: "Export Markdown" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Corridor atlas", exact: true })
    .click();
  await page.getByRole("button", { name: "Take the guided demo" }).click();
  await expect(
    page.getByRole("region", { name: "Guided demonstration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End guided demo" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "outputs/corridor-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Reset map view" }).click();
  expect(errors).toEqual([]);
});
