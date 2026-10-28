import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Real data sheets from the QA test set (small ones only). */
export const SHEETS = {
  amercoat: { file: path.join(here, "fixtures", "ppg_amercoat450h.pdf"), name: "ppg_amercoat450h.pdf" },
  carbozinc: { file: path.join(here, "fixtures", "carboline_carbozinc11.pdf"), name: "carboline_carbozinc11.pdf" },
  tnemec: { file: path.join(here, "fixtures", "tnemec_90-97.pdf"), name: "tnemec_90-97.pdf" },
} as const;

/** ZIP -> the city/state line the weather panel shows for it. */
export const SITES = {
  "22201": /Arlington, VA/,
  "77002": /Houston, TX/,
  "98101": /Seattle, WA/,
} as const;

/** Upload limit from src/lib/extract-client.ts (MAX_UPLOAD_BYTES = 10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** A verdict the user can act on: a scored day, the headline, paused windows, or "plan later". */
export const VERDICT =
  /(NO-GO|GO) · \d+ of \d+ work hours GO|Best window|No clean go-day|Forecast loaded — PDS has no numeric|This is not a GO\. Plan later/;

export function runId(): string {
  return `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
}

/** Random per run, never logged or written to a report. */
export function newPassword(): string {
  return `Qa-${randomBytes(18).toString("base64url")}`;
}

export function isTouch(testInfo: TestInfo): boolean {
  return Boolean(testInfo.project.use.hasTouch);
}

/** Tap on touch devices (like a phone user), click elsewhere. */
export async function press(target: Locator, testInfo: TestInfo): Promise<void> {
  if (isTouch(testInfo)) await target.tap();
  else await target.click();
}

/** Dismiss every confirm/alert unless a test opts in (guest-jobs move prompt is two confirms). */
export function autoDismissDialogs(page: Page, accept: () => boolean = () => false): string[] {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(d.message());
    void (accept() ? d.accept() : d.dismiss());
  });
  return seen;
}

export async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  const home = page.getByText("New project", { exact: true });
  const projectsBtn = page.getByRole("button", { name: "Projects" });
  // Signed-in users land back in their last project; go to the list from there.
  await expect(home.or(projectsBtn).first()).toBeVisible({ timeout: 45_000 });
  if (!(await home.isVisible())) await projectsBtn.click();
  await expect(home).toBeVisible();
}

export async function createProject(page: Page, testInfo: TestInfo, name: string, zip: string): Promise<void> {
  await page.getByLabel("Project name").fill(name);
  await page.locator("#proj-zip").fill(zip);
  await press(page.getByRole("button", { name: "Create" }), testInfo);
  await expect(page.getByRole("button", { name: "Upload sheet" })).toBeVisible();
  await expect(page.getByText(`${name} · ${zip}`)).toBeVisible();
}

/**
 * Tap "Upload sheet" and pick the file in the real file chooser. If tapping the button opens
 * no chooser (the DuckDuckGo-mobile P0), waitForEvent times out and the test fails here.
 */
export async function uploadSheet(page: Page, testInfo: TestInfo, file: string): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 15_000 });
  await press(page.getByRole("button", { name: "Upload sheet" }), testInfo);
  const chooser = await chooserPromise.catch(() => {
    throw new Error("Tapping 'Upload sheet' did not open a file chooser.");
  });
  await chooser.setFiles(file);
}

export async function expectLoaded(page: Page, fileName: string): Promise<void> {
  await expect(page.getByText(new RegExp(`Loaded ${fileName.replace(/[.]/g, "\\.")}`))).toBeVisible();
}

/** The product name on the job card (the line under the "Job card" kicker). Waits for the reader. */
export async function cardTitle(page: Page): Promise<string> {
  const read = async () => {
    const lines = (await page.locator("main").innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
    const i = lines.findIndex((l) => /· JOB CARD$/i.test(l));
    return i >= 0 ? (lines[i + 1] ?? "") : "";
  };
  await expect.poll(read, { timeout: 90_000, message: "job card never appeared" }).not.toBe("");
  return read();
}

/** Opens "Where each value came from" and returns its rows' text. */
export async function sourceRows(page: Page, testInfo: TestInfo): Promise<string[]> {
  const summary = page.getByText("Where each value came from", { exact: true });
  await expect(summary).toBeVisible({ timeout: 60_000 });
  await summary.scrollIntoViewIfNeeded();
  await press(summary, testInfo);
  const rows = page.locator("details[open] dl > div");
  await expect(rows.first()).toBeVisible();
  return rows.allInnerTexts();
}

export async function loadWindows(page: Page, testInfo: TestInfo, zip: string): Promise<void> {
  const zipBox = page.getByLabel("Job-site ZIP");
  await zipBox.fill(zip);
  await press(page.getByRole("button", { name: "Load windows" }), testInfo);
}

export async function expectVerdict(page: Page): Promise<string> {
  const v = page.getByText(VERDICT).or(page.getByTestId("windows-paused")).filter({ visible: true }).first();
  await expect(v).toBeVisible({ timeout: 60_000 });
  await v.scrollIntoViewIfNeeded();
  return (await v.innerText()).trim();
}

/** Types into a password box without the value showing up in step titles or logs. */
async function typeSecret(box: Locator, secret: string): Promise<void> {
  await box.evaluate((el, value) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, secret);
}

export async function signUp(page: Page, testInfo: TestInfo, email: string, password: string): Promise<void> {
  await page.goto("/login?mode=up");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Email").fill(email);
  await typeSecret(page.getByLabel("Password"), password);
  await press(page.getByRole("button", { name: "Create account" }), testInfo);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 45_000 });
}

export async function signIn(page: Page, testInfo: TestInfo, email: string, password: string): Promise<void> {
  await page.goto("/login?mode=in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Email").fill(email);
  await typeSecret(page.getByLabel("Password"), password);
  await press(page.getByRole("button", { name: "Sign in", exact: true }), testInfo);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 45_000 });
}

export async function signOut(page: Page, testInfo: TestInfo): Promise<void> {
  await press(page.getByRole("button", { name: "Sign out" }), testInfo);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible({ timeout: 45_000 });
}

/** Names on the Projects list. */
export async function projectNames(page: Page): Promise<string[]> {
  await expect(page.getByText("New project", { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.locator("article p.font-medium").allInnerTexts();
}

export async function openProjectByName(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const row = page.locator("article").filter({ hasText: name });
  await press(row.getByRole("button", { name: "Open" }), testInfo);
  await expect(page.getByRole("button", { name: "Upload sheet" })).toBeVisible();
}

export async function goToProjects(page: Page, testInfo: TestInfo): Promise<void> {
  await press(page.getByRole("button", { name: "Projects" }), testInfo);
  await expect(page.getByText("New project", { exact: true })).toBeVisible();
}
