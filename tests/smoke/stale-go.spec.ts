import { expect, test } from "@playwright/test";
import { SHEETS, VERDICT, autoDismissDialogs, createProject, expectVerdict, loadWindows, openHome, runId, uploadSheet } from "./helpers";

/** Copy the app shows when every weather source is down (src/lib/forecast-sources.ts). */
const FORECAST_DOWN =
  "Forecast unavailable: the weather services did not answer. This is not a GO. Plan later or check the site conditions by hand.";

/** A TanStack Start server-function reply carrying { ok: false, error } (seroval wire format). */
function serverFnError(message: string): string {
  return JSON.stringify({
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [
        { t: 10, i: 1, p: { k: ["ok", "error"], v: [{ t: 2, s: 3 }, { t: 1, s: message }] }, o: 0 },
        { t: 2, s: 1 },
        { t: 11, i: 2, p: { k: [], v: [] }, o: 0 },
      ],
    },
    o: 0,
  });
}

test("D4: a good forecast load, then a failed reload, leaves no verdict on screen", async ({ page }, testInfo) => {
  autoDismissDialogs(page);
  // Only the reload fails: the forecast server-function call gets the app's own outage reply.
  let failForecast = false;
  let faked = 0;
  await page.route("**/_serverFn/**", async (route) => {
    const req = route.request();
    const body = req.postData() ?? "";
    if (failForecast && req.method() === "POST" && body.includes('"zip"') && body.includes('"environmentals"')) {
      faked += 1;
      const real = await route.fetch();
      await route.fulfill({ response: real, body: serverFnError(FORECAST_DOWN) });
      return;
    }
    await route.continue();
  });

  await openHome(page);
  await createProject(page, testInfo, `Smoke stale ${runId()}`, "22201");
  await uploadSheet(page, testInfo, SHEETS.amercoat.file);
  await expect(page.getByText(/Amercoat 450H/).first()).toBeVisible({ timeout: 60_000 });

  // 1. Good load: a real verdict and today's line.
  await loadWindows(page, testInfo, "22201");
  await expect(page.getByText(/Arlington, VA/).first()).toBeVisible({ timeout: 60_000 });
  await expectVerdict(page);
  await expect(page.getByTestId("today-verdict").filter({ visible: true }).first()).toBeVisible();

  // 2. Reload fails: the outage message replaces every verdict.
  failForecast = true;
  await loadWindows(page, testInfo, "22201");
  await expect(page.getByText(FORECAST_DOWN).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
  expect(faked).toBeGreaterThan(0);
  await expect(page.getByTestId("today-verdict")).toHaveCount(0);
  await expect(page.getByText(/(^|\s)(NO-GO|GO) · \d+ of \d+ work hours GO/)).toHaveCount(0);
  await expect(page.getByText(VERDICT).filter({ hasNotText: "Plan later" })).toHaveCount(0);
});
