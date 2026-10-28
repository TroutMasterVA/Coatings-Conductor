import { expect, test, type APIResponse, type Page, type Request, type TestInfo } from "@playwright/test";
import {
  SHEETS,
  SITES,
  autoDismissDialogs,
  cardTitle,
  createProject,
  expectLoaded,
  expectVerdict,
  goToProjects,
  loadWindows,
  newPassword,
  openHome,
  openProjectByName,
  projectNames,
  runId,
  signIn,
  signOut,
  signUp,
  uploadSheet,
} from "./helpers";

// Server-side behaviour (accounts, storage, access checks) is the same on every device:
// run these once, on desktop Chrome, to keep the run short. Traces off: passwords are typed.
test.use({ trace: "off" });

type Job = { name: string; zip: keyof typeof SITES; sheet: (typeof SHEETS)[keyof typeof SHEETS]; title?: string };

/** The openProject server-function call made when the user taps Open on a project. */
async function captureOpen(page: Page, testInfo: TestInfo, name: string): Promise<Request> {
  const seen: Request[] = [];
  const onReq = (r: Request) => {
    if (r.method() === "POST" && r.url().includes("/_serverFn/")) seen.push(r);
  };
  page.on("request", onReq);
  await openProjectByName(page, testInfo, name);
  await page.waitForLoadState("networkidle").catch(() => {});
  page.off("request", onReq);
  for (const r of seen) {
    const res = await r.response();
    const body = res ? await res.text().catch(() => "") : "";
    if (body.includes(name) && body.includes("calibration")) return r;
  }
  throw new Error(`no server call returned project ${name}`);
}

async function replay(page: Page, req: Request): Promise<APIResponse> {
  const headers = Object.fromEntries(
    Object.entries(await req.allHeaders()).filter(([k]) => !k.startsWith(":") && !["cookie", "host", "content-length"].includes(k)),
  );
  return page.request.fetch(req.url(), { method: "POST", data: req.postData() ?? "", headers });
}

test("one user, three projects stay separate and persist; user B and guests cannot see or open them", async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "server-side checks run on desktop Chrome only");
  test.setTimeout(600_000);
  autoDismissDialogs(page);
  const id = runId();
  const emailA = `qa-smoke-${id}-a@example.com`;
  const passA = newPassword();
  const jobs: Job[] = [
    { name: `A1 ${id}`, zip: "22201", sheet: SHEETS.amercoat },
    { name: `A2 ${id}`, zip: "77002", sheet: SHEETS.carbozinc },
    { name: `A3 ${id}`, zip: "98101", sheet: SHEETS.tnemec },
  ];

  await test.step("user A builds three projects, each with its own sheet and site", async () => {
    await signUp(page, testInfo, emailA, passA);
    for (const job of jobs) {
      await openHome(page);
      await createProject(page, testInfo, job.name, job.zip);
      await uploadSheet(page, testInfo, job.sheet.file);
      await expectLoaded(page, job.sheet.name);
      job.title = await cardTitle(page);
      expect(job.title, `card title for ${job.sheet.name}`).not.toBe("");
      await page.waitForTimeout(2_500); // autosave
      await goToProjects(page, testInfo);
    }
    expect(new Set(jobs.map((j) => j.title)).size, "three different sheets give three different cards").toBe(3);
  });

  async function checkAll(p: Page, label: string) {
    await openHome(p);
    expect((await projectNames(p)).sort(), `${label}: project list`).toEqual(jobs.map((j) => j.name).sort());
    for (const job of jobs) {
      await openProjectByName(p, testInfo, job.name);
      await expect(p.getByText(`${job.name} · ${job.zip}`), `${label}: header`).toBeVisible();
      expect(await cardTitle(p), `${label}: ${job.name} card`).toBe(job.title);
      for (const other of jobs.filter((o) => o !== job)) {
        await expect(p.locator("main").getByText(other.name)).toHaveCount(0);
      }
      await expect(p.getByLabel("Job-site ZIP")).toHaveValue(job.zip);
      await loadWindows(p, testInfo, job.zip);
      await expect(p.getByText(SITES[job.zip]).filter({ visible: true }).first(), `${label}: ${job.name} site`).toBeVisible({ timeout: 60_000 });
      await expectVerdict(p);
      await goToProjects(p, testInfo);
    }
  }

  await test.step("switching between them keeps sheets, sites and verdicts apart", () => checkAll(page, "same session"));

  await test.step("still there after sign-out and sign-in", async () => {
    await signOut(page, testInfo);
    expect(await projectNames(page)).not.toContain(jobs[0].name);
    await signIn(page, testInfo, emailA, passA);
    await checkAll(page, "after sign-in");
  });

  await test.step("still there on a second device (fresh browser context)", async () => {
    const ctx = await browser.newContext({ ...testInfo.project.use });
    const p2 = await ctx.newPage();
    autoDismissDialogs(p2);
    await signIn(p2, testInfo, emailA, passA);
    await checkAll(p2, "second device");
    await ctx.close();
  });

  // Capture A's own "open project" call so B can try it directly.
  await openHome(page);
  const openReq = await captureOpen(page, testInfo, jobs[0].name);
  const projectId = /"s":"([^"]{8,})"/.exec(openReq.postData() ?? "")?.[1] ?? "";
  expect(projectId).not.toBe("");
  const own = await replay(page, openReq);
  expect(own.status(), "A can open their own project by direct call").toBe(200);
  expect(await own.text()).toContain(jobs[0].name);

  const leaks = (body: string) => jobs.some((j) => body.includes(j.name)) || body.includes(emailA);

  await test.step("user B never sees or opens A's projects", async () => {
    const ctxB = await browser.newContext({ ...testInfo.project.use });
    const pb = await ctxB.newPage();
    autoDismissDialogs(pb);
    await signUp(pb, testInfo, `qa-smoke-${id}-b@example.com`, newPassword());
    await openHome(pb);
    expect(await projectNames(pb), "B's list").toEqual([]);

    // Direct server call with A's project id, as B.
    const asB = await replay(pb, openReq);
    const bodyB = await asB.text();
    testInfo.annotations.push({ type: "B opens A's project by direct call", description: `HTTP ${asB.status()} body: ${bodyB.slice(0, 300)}` });
    expect(leaks(bodyB), `B's direct call returned A's data (HTTP ${asB.status()})`).toBe(false);
    expect.soft([401, 403, 404], `B's direct call should be refused with 401/403/404, got ${asB.status()}`).toContain(asB.status());

    // Direct page URLs carrying A's project id.
    for (const url of [`/?project=${projectId}`, `/?id=${projectId}`, `/project/${projectId}`, `/job/${projectId}`]) {
      const res = await pb.goto(url);
      await pb.waitForLoadState("networkidle").catch(() => {});
      const html = (await res?.text()) ?? "";
      const shown = await pb.locator("body").innerText();
      testInfo.annotations.push({ type: `B direct URL ${url}`, description: `HTTP ${res?.status()}` });
      expect(leaks(html) || leaks(shown), `B saw A's data at ${url}`).toBe(false);
    }
    await ctxB.close();

    // No session at all.
    const anon = await browser.newContext();
    const ap = await anon.newPage();
    const asAnon = await replay(ap, openReq);
    testInfo.annotations.push({ type: "no-session direct call", description: `HTTP ${asAnon.status()}` });
    expect(leaks(await asAnon.text()), "a signed-out direct call returned A's data").toBe(false);
    await anon.close();
  });

  await test.step("a guest's project never shows to a signed-in user or another guest", async () => {
    const g1 = await browser.newContext({ ...testInfo.project.use });
    const gp = await g1.newPage();
    autoDismissDialogs(gp);
    await openHome(gp);
    const guestJob = `Guest ${id}`;
    await createProject(gp, testInfo, guestJob, "22201");
    await gp.waitForTimeout(1_500);
    await openHome(gp);
    expect(await projectNames(gp)).toContain(guestJob);

    const g2 = await browser.newContext({ ...testInfo.project.use });
    const gp2 = await g2.newPage();
    autoDismissDialogs(gp2);
    await openHome(gp2);
    expect(await projectNames(gp2), "another guest").not.toContain(guestJob);
    await g2.close();
    await g1.close();

    await openHome(page); // A, signed in, other browser
    expect(await projectNames(page), "signed-in user A").not.toContain(guestJob);
  });
});
