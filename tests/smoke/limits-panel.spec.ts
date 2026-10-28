import { expect, test } from "@playwright/test";
import {
  SHEETS,
  autoDismissDialogs,
  cardTitle,
  createProject,
  expectVerdict,
  loadWindows,
  openHome,
  runId,
  uploadSheet,
} from "./helpers";

/**
 * Planned full editable limits panel (LEAD, not built yet). Each field should come from the sheet
 * with a quote, or say "Not stated / check the sheet", and be editable and saved per project.
 */
const PLANNED_FIELDS: Record<string, RegExp> = {
  "substrate temp min": /substrate (temp )?min/i,
  "substrate temp max": /substrate (temp )?max/i,
  "air temp": /air (temp|min|max)/i,
  "material temp": /material (temp)?/i,
  RH: /\bRH\b|humidity/i,
  "dew margin": /dew (spread|margin)/i,
  wind: /wind/i,
  "rain-free time": /rain[- ]free|dry only/i,
  induction: /induction/i,
  "pot life": /pot life/i,
  "dry times": /dry (time|to)/i,
  recoat: /recoat/i,
  cure: /\bcure\b/i,
  "DFT/WFT": /\bDFT\b|\bWFT\b/i,
  thinning: /thin/i,
};

test("limits panel: edit substrate min, save, reload, verdict flips", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "panel inventory runs once, on desktop Chrome");
  autoDismissDialogs(page);
  await openHome(page);
  await createProject(page, testInfo, `Smoke limits ${runId()}`, "22201");
  await uploadSheet(page, testInfo, SHEETS.amercoat.file);
  await cardTitle(page);
  await loadWindows(page, testInfo, "22201");
  const before = await expectVerdict(page);

  // Inventory: which planned fields the limits panel has today.
  const panel = page.getByText(/Window limits/i).first().locator("xpath=..");
  await expect(panel).toBeVisible();
  const labels = (await panel.locator("label").allInnerTexts()).map((l) => l.trim()).filter(Boolean);
  const missing = Object.entries(PLANNED_FIELDS)
    .filter(([, re]) => !labels.some((l) => re.test(l)))
    .map(([name]) => name);
  testInfo.annotations.push({ type: "limits panel fields present", description: labels.join(" | ") });
  for (const name of missing) testInfo.annotations.push({ type: "bug: limits panel field missing", description: name });

  const subMin = panel.getByLabel(/substrate (temp )?min/i);
  test.skip(
    (await subMin.count()) === 0,
    `Full editable limits panel is not on this build (no "Substrate min" field). Missing: ${missing.join(", ")}`,
  );

  // Planned behaviour: an impossible substrate minimum makes every hour NO-GO.
  await subMin.fill("200");
  const save = panel.getByRole("button", { name: /save/i });
  if (await save.count()) await save.click();
  else await subMin.press("Enter");
  await page.waitForTimeout(3_000);
  await page.reload();
  await expect(page.getByLabel(/substrate (temp )?min/i)).toHaveValue("200");
  await expect(page.getByText(/edited/i).first()).toBeVisible();
  await loadWindows(page, testInfo, "22201");
  const after = await expectVerdict(page);
  expect(after).not.toBe(before);
  await expect(page.getByText(/(^|\s)GO · \d+ of \d+ work hours GO/)).toHaveCount(0);
});
