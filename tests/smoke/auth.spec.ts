import { expect, test } from "@playwright/test";
import {
  SHEETS,
  autoDismissDialogs,
  cardTitle,
  createProject,
  expectLoaded,
  newPassword,
  openHome,
  projectNames,
  runId,
  signIn,
  signOut,
  signUp,
  uploadSheet,
} from "./helpers";

// Traces record typed values; keep them off where a password is typed.
test.use({ trace: "off" });

test("sign up, sign out, sign back in; a user sees only their own job", async ({ page, browser }, testInfo) => {
  autoDismissDialogs(page);
  const id = runId();
  const email = `qa-smoke-${id}@example.com`;
  const password = newPassword();

  // New user.
  await signUp(page, testInfo, email, password);
  await openHome(page);
  expect(await projectNames(page)).toEqual([]);
  const job = `Smoke own ${id}`;
  await createProject(page, testInfo, job, "22201");
  await uploadSheet(page, testInfo, SHEETS.amercoat.file);
  await expectLoaded(page, SHEETS.amercoat.name);
  expect(await cardTitle(page)).toBe("Amercoat 450H");
  await page.waitForTimeout(2_500); // let autosave land

  // Sign out: the guest view does not show the account's job.
  await page.goto("/");
  await signOut(page, testInfo);
  expect(await projectNames(page)).not.toContain(job);

  // Returning user.
  await signIn(page, testInfo, email, password);
  await openHome(page);
  expect(await projectNames(page)).toEqual([job]);

  // A second, separate user never sees it.
  const other = await browser.newContext({ ...testInfo.project.use });
  const p2 = await other.newPage();
  autoDismissDialogs(p2);
  await signUp(p2, testInfo, `qa-smoke-${id}-b@example.com`, newPassword());
  await openHome(p2);
  expect(await projectNames(p2)).toEqual([]);
  await other.close();
});
