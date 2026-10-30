import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { SHEETS, autoDismissDialogs, createProject, newPassword, openHome, runId, signUp, uploadSheet } from "./helpers";

/**
 * P2 413 fix (Oct 30). Vercel refuses a function request body over 4.5 MB with its own 413
 * (measured: 4,493,994 bytes pass, one more fails). The sheet goes up as base64 (~4/3 of the
 * file), so on Vercel the app's limit is 3 MB. These files are padded real sheets built per run.
 */
const SIZE_COPY = "This file is too large for the reader. Use a smaller file.";

async function paddedSheet(testInfo: TestInfo, name: string, bytes: number): Promise<string> {
  const file = testInfo.outputPath(name);
  const sheet = readFileSync(SHEETS.amercoat.file);
  await writeFile(file, Buffer.concat([sheet, Buffer.alloc(Math.max(0, bytes - sheet.length), 0x20)]));
  return file;
}

async function expectNoDraft(page: Page): Promise<void> {
  await page.waitForTimeout(2_000);
  await expect(page.getByText("Unnamed product")).toHaveCount(0);
  await expect(page.getByText(/· JOB CARD$/i)).toHaveCount(0);
}

test.describe("upload size (host limit)", () => {
  test("a 5 MB file (over the host's 4.5 MB request cap) is refused with the limit, no draft", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    const big = await paddedSheet(testInfo, "over-host-limit.pdf", 5 * 1024 * 1024);
    await openHome(page);
    await createProject(page, testInfo, `Smoke 5MB ${runId()}`, "22201");
    await uploadSheet(page, testInfo, big);
    const alert = page.getByRole("alert").filter({ hasText: /upload limit on this copy|too large for the reader/ }).first();
    await expect(alert).toBeVisible({ timeout: 60_000 });
    // Honest number for this host: on Vercel never above 3 MB.
    await expect(alert).toContainText(/File is over [0-3](\.\d)? MB, the upload limit on this copy\./);
    await expect(alert).toContainText(SIZE_COPY);
    await expectNoDraft(page);
  });

  test.describe("signed in", () => {
    test.use({ trace: "off" });
    test("a host 413 that gets past the browser check still shows the size message, no draft", async ({ page }, testInfo) => {
      autoDismissDialogs(page);
      // Hide the server's limit from the page (getExtractLimits fails), so the browser only knows
      // the 10 MB ceiling and really sends a 3.6 MB file (~4.8 MB as base64) to the host.
      await page.route("**/_serverFn/**", async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const real = await route.fetch();
        const body = await real.text();
        if (body.includes("maxUploadMb")) return route.fulfill({ status: 500, contentType: "text/plain", body: "limits hidden by test" });
        return route.fulfill({ response: real, body });
      });
      const host413: number[] = [];
      page.on("response", (r) => {
        if (r.status() === 413 && r.url().includes("/_serverFn/")) host413.push(r.status());
      });
      await signUp(page, testInfo, `qa-smoke-413-${runId()}@example.com`, newPassword());
      await openHome(page);
      await createProject(page, testInfo, `Smoke 413 ${runId()}`, "22201");
      const big = await paddedSheet(testInfo, "host-413.pdf", Math.round(3.6 * 1024 * 1024));
      await uploadSheet(page, testInfo, big);
      await expect(page.getByRole("alert").filter({ hasText: SIZE_COPY }).first()).toBeVisible({ timeout: 60_000 });
      expect(host413.length, "the host answered 413").toBeGreaterThan(0);
      await expectNoDraft(page);
    });
  });
});
