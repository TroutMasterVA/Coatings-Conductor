import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SHEETS, autoDismissDialogs, createProject, openHome, runId, uploadSheet } from "./helpers";

async function expectNoCard(page: Page): Promise<void> {
  await page.waitForTimeout(2_000);
  await expect(page.getByText("Unnamed product")).toHaveCount(0);
  await expect(page.getByText(/· JOB CARD$/i)).toHaveCount(0);
  await expect(page.getByText("Draft — verify every number")).toHaveCount(0);
}

test.describe("guest uploads that can't be read (QA #55)", () => {
  test("D1: a truncated PDF shows the clear failure message and makes no card", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    // The first 40,000 bytes of a real sheet: starts with %PDF-, but no xref/trailer and no text.
    const truncated = testInfo.outputPath("corrupt_truncated.pdf");
    await writeFile(truncated, readFileSync(SHEETS.amercoat.file).subarray(0, 40_000));
    await openHome(page);
    await createProject(page, testInfo, `Smoke trunc ${runId()}`, "22201");
    await uploadSheet(page, testInfo, truncated);
    await expect(
      page.getByText(/Nothing could be read from this file, so no job card was made\.|Could not read this sheet\./).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Failed: /).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Loaded corrupt_truncated\.pdf/)).toHaveCount(0);
    await expectNoCard(page);
    await expect(page.getByRole("button", { name: "Build job card" })).toBeDisabled();
  });

  test("D2: a refused oversize file leaves the paste box empty and Build job card disabled", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    const big = testInfo.outputPath("oversize.pdf");
    const sheet = readFileSync(SHEETS.amercoat.file);
    await writeFile(big, Buffer.concat([sheet, Buffer.alloc(11 * 1024 * 1024 - sheet.length, 0x20)]));
    await openHome(page);
    await createProject(page, testInfo, `Smoke paste ${runId()}`, "22201");
    await uploadSheet(page, testInfo, big);
    await expect(page.getByText(/upload limit on this copy/).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await expect(page.locator("#pds")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Build job card" })).toBeDisabled();
    await expectNoCard(page);
  });
});
