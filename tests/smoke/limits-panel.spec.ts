import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  SHEETS,
  autoDismissDialogs,
  cardTitle,
  createProject,
  expectVerdict,
  loadWindows,
  newPassword,
  openHome,
  openProjectByName,
  runId,
  signIn,
  signUp,
  uploadSheet,
} from "./helpers";

// Passwords are typed in the signed-in mode: keep traces off in this file.
test.use({ trace: "off" });

/** Planned fields of the full editable limits panel (PO list) -> how the real label reads. */
const PLANNED_FIELDS: Record<string, RegExp> = {
  "substrate temp min": /surface \(substrate\) min|substrate (temp )?min/i,
  "substrate temp max": /surface \(substrate\) max|substrate (temp )?max/i,
  "air temp": /\bair (temp|min|max)/i,
  "material temp": /material/i,
  RH: /\bRH\b|humidity/i,
  "dew margin": /dew[- ]point margin|dew (spread|margin)/i,
  wind: /wind/i,
  "rain-free time": /rain[- ]free/i,
  induction: /induction/i,
  "pot life": /pot life/i,
  "dry times": /dry to/i,
  recoat: /recoat/i,
  cure: /\bcure\b/i,
  "DFT/WFT": /\bDFT\b|\bWFT\b/i,
  thinning: /thinning/i,
};

/** Each edit is chosen so the verdict can only get worse (fewer GO hours). */
const FIELDS = [
  { key: "substrateTempMinF", name: "surface (substrate) temp min", value: "200" },
  { key: "relativeHumidityMax", name: "RH max", value: "1" },
  { key: "relativeHumidityMin", name: "RH min", value: "99" },
  { key: "windMaxMph", name: "wind max", value: "0" },
] as const;

/** Total GO work hours across the visible day cards ("NO-GO · 10 of 13 work hours GO · ..."). */
async function goHours(page: Page): Promise<number> {
  const lines = await page.getByText(/\d+ of \d+ work hours GO/).filter({ visible: true }).allInnerTexts();
  return lines.reduce((sum, l) => sum + Number(/(\d+) of \d+ work hours GO/.exec(l)?.[1] ?? 0), 0);
}

async function runField(page: Page, testInfo: TestInfo, field: (typeof FIELDS)[number], mode: string) {
  const note = (type: string, description: string) => testInfo.annotations.push({ type, description });
  const project = `LP ${field.key} ${runId()}`;
  await openHome(page);
  await createProject(page, testInfo, project, "22201");
  await uploadSheet(page, testInfo, SHEETS.amercoat.file);
  await cardTitle(page);
  await loadWindows(page, testInfo, "22201");
  await expectVerdict(page);
  const before = await goHours(page);
  note("GO hours before", String(before));

  const row = page.getByTestId(`limit-${field.key}`);
  await expect(row, `limits panel has a ${field.name} field`).toBeVisible();
  const src = page.getByTestId(`limit-${field.key}-src`);
  const input = row.locator("input");
  const readValue = await input.inputValue();
  const readSrc = (await src.getAttribute("data-src")) ?? "";
  const readText = (await src.innerText()).trim();
  note(`${mode} ${field.name} as read`, `value="${readValue}" source=${readSrc} "${readText}"`);
  // (read) sheet value with a quote, or the check-the-sheet flag.
  if (readSrc === "sheet") expect.soft(readText, "sheet value shows its quote").toMatch(/from sheet · \S/);
  else expect.soft(readText).toMatch(/Not stated — check the sheet/);

  // Edit, then let the project autosave (server for accounts, device store for guests).
  await input.fill(field.value);
  await expect(src).toHaveAttribute("data-src", "edited");
  await page.waitForTimeout(4_000);

  await page.reload();
  const home = page.getByText("New project", { exact: true });
  await expect(home.or(page.getByTestId(`limit-${field.key}`)).first()).toBeVisible({ timeout: 45_000 });
  if (await home.isVisible()) await openProjectByName(page, testInfo, project);

  // (a) persisted
  await expect(page.getByTestId(`limit-${field.key}`).locator("input"), "(a) value persisted after reload").toHaveValue(field.value);
  // (b) user-edited mark
  await expect.soft(page.getByTestId(`limit-${field.key}-src`), "(b) user-edited mark after reload").toHaveText(/user-edited/);
  // (c) verdict moved the expected way
  await loadWindows(page, testInfo, "22201");
  await expectVerdict(page);
  const after = await goHours(page);
  note("GO hours after", String(after));
  if (before > 0) expect(after, `(c) GO hours should drop (before ${before})`).toBeLessThan(before);
  if (field.key !== "windMaxMph") {
    // Impossible limits: no day may still read GO.
    await expect(page.getByText(/(^|\s)GO · \d+ of \d+ work hours GO/).filter({ visible: true }), "(c) no GO day").toHaveCount(0);
  }
}

test.describe("limits panel", () => {
  test("planned fields present on the panel", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "inventory runs once, on desktop Chrome");
    autoDismissDialogs(page);
    await openHome(page);
    await createProject(page, testInfo, `LP inventory ${runId()}`, "22201");
    await uploadSheet(page, testInfo, SHEETS.amercoat.file);
    await cardTitle(page);
    const panel = page.getByTestId("limits-panel");
    await expect(panel, "full limits panel is on this build").toBeVisible();
    const labels = (await panel.locator("label > span").allInnerTexts()).concat(await panel.locator("label").allInnerTexts());
    const present = Object.keys(PLANNED_FIELDS).filter((n) => labels.some((l) => PLANNED_FIELDS[n].test(l)));
    const missing = Object.keys(PLANNED_FIELDS).filter((n) => !present.includes(n));
    testInfo.annotations.push({ type: "fields present", description: present.join(", ") });
    for (const m of missing) testInfo.annotations.push({ type: "bug: planned field missing", description: m });
  });

  test.describe("guest", () => {
    for (const field of FIELDS) {
      test(`guest edits ${field.name}`, async ({ page }, testInfo) => {
        autoDismissDialogs(page);
        await runField(page, testInfo, field, "guest");
      });
    }
  });

  test.describe("signed in", () => {
    const email = `qa-smoke-${runId()}@example.com`;
    const password = newPassword();
    let made = false;
    for (const field of FIELDS) {
      test(`signed-in user edits ${field.name}`, async ({ page }, testInfo) => {
        autoDismissDialogs(page);
        if (!made) {
          await signUp(page, testInfo, email, password);
          made = true;
        } else {
          await signIn(page, testInfo, email, password);
        }
        await runField(page, testInfo, field, "signed-in");
      });
    }
  });
});
