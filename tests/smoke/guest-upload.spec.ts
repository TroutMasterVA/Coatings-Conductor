import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  SHEETS,
  autoDismissDialogs,
  cardTitle,
  createProject,
  expectLoaded,
  expectVerdict,
  loadWindows,
  openHome,
  runId,
  sourceRows,
  uploadSheet,
} from "./helpers";

test.describe("guest main path", () => {
  test("guest uploads a real sheet and gets a verdict", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    await openHome(page);
    // A guest: no account, offered sign-in.
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await createProject(page, testInfo, `Smoke guest ${runId()}`, "22201");
    await uploadSheet(page, testInfo, SHEETS.amercoat.file);

    // Loaded state names the file.
    await expectLoaded(page, SHEETS.amercoat.name);

    // Job card with the extracted limits.
    expect(await cardTitle(page)).toBe("Amercoat 450H");
    await expect(page.getByText("Draft — verify every number")).toBeVisible();
    await expect(page.getByText(/POT LIFE/i).first()).toBeVisible();
    await expect(page.getByText("2 hours at 90°F, 4 hours at 70°F, 6 hours at 50°F").first()).toBeVisible();

    // Where each value came from: rows with quotes from the sheet.
    const rows = await sourceRows(page, testInfo);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.some((r) => /pot life/i.test(r) && /90/.test(r))).toBeTruthy();

    // Pick the site and get a verdict.
    await loadWindows(page, testInfo, "22201");
    await expect(page.getByText(/Arlington, VA/).first()).toBeVisible({ timeout: 60_000 });
    const verdict = await expectVerdict(page);
    testInfo.annotations.push({ type: "verdict", description: verdict });
  });

  test("picking the same file twice loads it both times (picker resets)", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    await openHome(page);
    await createProject(page, testInfo, `Smoke twice ${runId()}`, "22201");
    await uploadSheet(page, testInfo, SHEETS.carbozinc.file);
    await expectLoaded(page, SHEETS.carbozinc.name);
    await cardTitle(page);
    // Picker reset: after a pick the file input is cleared, so the same file can be picked again.
    const input = page.locator('input[type="file"]');
    await expect.poll(() => input.evaluate((el) => (el as HTMLInputElement).value), { message: "file input not reset after pick" }).toBe("");
    // Watch for the app reacting to the second pick ("Uploading", then "Loaded <name>" again).
    await page.evaluate(() => {
      const w = window as unknown as { __uploading: boolean };
      w.__uploading = false;
      new MutationObserver(() => {
        if (document.body.innerText.includes("Uploading")) w.__uploading = true;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await uploadSheet(page, testInfo, SHEETS.carbozinc.file);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __uploading: boolean }).__uploading), {
        message: "second pick of the same file showed no Uploading state",
        timeout: 20_000,
      })
      .toBe(true);
    await expectLoaded(page, SHEETS.carbozinc.name);
  });

  test("a non-PDF fails with a visible reason", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    const photo = testInfo.outputPath("site-photo.png");
    await writeFile(photo, Buffer.from("not really an image, just bytes ".repeat(40)));
    await openHome(page);
    await createProject(page, testInfo, `Smoke nonpdf ${runId()}`, "22201");
    await uploadSheet(page, testInfo, photo);
    await expect(
      page.getByText(/Failed: |Sign in to read photos, scans, and Word files|isn.t supported/).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
