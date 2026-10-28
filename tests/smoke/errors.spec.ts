import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  MAX_UPLOAD_BYTES,
  SHEETS,
  VERDICT,
  autoDismissDialogs,
  createProject,
  openHome,
  runId,
  uploadSheet,
} from "./helpers";

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

test.describe("error states", () => {
  test("bad file: a text file named .pdf never gets a GO", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    const bad = testInfo.outputPath("not-a-sheet.pdf");
    await writeFile(bad, "This is plain text pretending to be a PDF.\n".repeat(20));
    await openHome(page);
    await createProject(page, testInfo, `Smoke bad ${runId()}`, "22201");
    await uploadSheet(page, testInfo, bad);
    // The user is told the file could not be read properly.
    await expect(
      page.getByText(/Failed: |needs the Azure reader|couldn.t read this sheet|isn.t supported|Unnamed product/).first(),
    ).toBeVisible({ timeout: 60_000 });
    // And nothing scores this unreadable file as a go day.
    await page.waitForTimeout(3_000);
    await expect(page.getByText(/(^|\s)GO · \d+ of \d+ work hours GO/)).toHaveCount(0);
  });

  test("too-large file: over the 10 MB upload limit is refused", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    const big = testInfo.outputPath("too-large.pdf");
    // A real sheet padded past the limit (generated per run, never committed).
    await writeFile(big, Buffer.concat([readFileSync(SHEETS.amercoat.file), Buffer.alloc(MAX_UPLOAD_BYTES + 512 * 1024, 0x20)]));
    await openHome(page);
    await createProject(page, testInfo, `Smoke big ${runId()}`, "22201");
    await uploadSheet(page, testInfo, big);
    await expect(page.getByText(/File is over 10 MB, the upload limit on this copy\.|too large for the reader/).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("weather service down: shows plan later, never GO", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    // The forecast is fetched server-side (loadForecast server function), so the browser never
    // calls api.weather.gov. We fake the outage at the browser boundary: the forecast server-function
    // call gets the app's own "all weather services down" reply. App code is untouched.
    let faked = 0;
    await page.route("**/_serverFn/**", async (route) => {
      const req = route.request();
      const body = req.postData() ?? "";
      if (req.method() === "POST" && body.includes('"zip"') && body.includes('"environmentals"')) {
        faked += 1;
        // Keep the real reply's headers (server-function framing) but swap in the outage body.
        const real = await route.fetch();
        await route.fulfill({ response: real, body: serverFnError(FORECAST_DOWN) });
        return;
      }
      await route.continue();
    });
    await openHome(page);
    await createProject(page, testInfo, `Smoke wx ${runId()}`, "22201");
    await uploadSheet(page, testInfo, SHEETS.amercoat.file);
    await expect(page.getByText(/Amercoat 450H/).first()).toBeVisible({ timeout: 60_000 });
    await page.getByLabel("Job-site ZIP").fill("22201");
    await page.getByRole("button", { name: "Load windows" }).click();
    await expect(page.getByText(FORECAST_DOWN)).toBeVisible();
    expect(faked).toBeGreaterThan(0);
    await expect(page.getByText(VERDICT).filter({ hasNotText: "Plan later" })).toHaveCount(0);
  });
});
