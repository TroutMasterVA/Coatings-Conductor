import { expect, test } from "@playwright/test";
import { SHEETS, autoDismissDialogs, cardTitle, createProject, expectVerdict, loadWindows, openHome, runId, uploadSheet } from "./helpers";

// Item 5 (material temperature). Carbozinc 11's condition table has a Material column:
// Minimum 0°F, Maximum 130°F (the limit) and Normal 40–95°F (info only).
test.describe("material temperature", () => {
  test("guest: material limit from the sheet, measure line, reading with its time", async ({ page }, testInfo) => {
    autoDismissDialogs(page);
    await openHome(page);
    await createProject(page, testInfo, `MT guest ${runId()}`, "22201");
    await uploadSheet(page, testInfo, SHEETS.carbozinc.file);
    await cardTitle(page);

    // Limits panel: the absolute min/max from the sheet, with their quote; Normal as info.
    const min = page.getByTestId("limit-materialTempMinF");
    await expect(min.locator("input")).toHaveValue("0");
    await expect(page.getByTestId("limit-materialTempMaxF").locator("input")).toHaveValue("130");
    await expect(page.getByTestId("limit-materialTempMinF-src")).toHaveAttribute("data-src", "sheet");
    await expect(page.getByTestId("material-normal")).toContainText("40–95°F (info only, not scored)");
    // Job card chip.
    await expect(page.getByText("Material 0–130°F").first()).toBeVisible();

    await loadWindows(page, testInfo, "22201");
    await expectVerdict(page);

    // No reading yet: every scored day says to measure; today is never GO.
    await expect(page.getByTestId("day-material-line").filter({ visible: true }).first()).toHaveText("Measure material temp before mixing");
    const today = page.getByTestId("today-verdict");
    await expect(today).toBeVisible();
    const before = (await today.getAttribute("data-status")) ?? "none";
    testInfo.annotations.push({ type: "today before reading", description: before });
    expect(before, "today with a stated material limit and no reading is never GO").not.toBe("go");

    // Enter a reading: its time shows next to it, and today's measure line goes away.
    const field = page.locator("#measured-material");
    await field.scrollIntoViewIfNeeded();
    await field.fill("55");
    await expect(page.getByTestId("material-reading-time")).toContainText(/Taken \d{1,2}:\d{2}\s?[AP]M · counts until \d{1,2}:\d{2}\s?[AP]M/);
    if (before !== "none") {
      await expect(page.getByTestId("today-material-line")).toHaveCount(0);
      testInfo.annotations.push({ type: "today after reading", description: (await today.getAttribute("data-status")) ?? "" });
    }
  });
});
