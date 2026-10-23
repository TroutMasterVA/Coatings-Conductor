import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAutosave,
  CLOSE_CONFIRM_TEXT,
  closedBadgeText,
  isClosed,
  isJobClosedError,
  JOB_CLOSED_DELETE_MESSAGE,
  JOB_CLOSED_MESSAGE,
  deleteErrorMessage,
  rowActions,
  jobStatusOf,
  mapCloseError,
  mapCloseResult,
} from "./job-status.ts";
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";
import { mapServerResponse, extractUpload, ISSUE_COPY } from "./extract-client.ts";

describe("job status mapping (CONTRACT closeout)", () => {
  it("missing or unknown status = open (older jobs)", () => {
    assert.deepEqual(jobStatusOf({}), { status: "open", closedAt: null, closedBy: null });
    assert.deepEqual(jobStatusOf(undefined), { status: "open", closedAt: null, closedBy: null });
    assert.equal(isClosed({ status: "weird" as never }), false);
    // An open job never shows stray closed fields.
    assert.deepEqual(
      jobStatusOf({ status: "open", closedAt: "2026-10-18T20:00:00Z" }).closedAt,
      null,
    );
  });
  it("closed keeps closedAt and closedBy", () => {
    const v = jobStatusOf({
      status: "closed",
      closedAt: "2026-10-18T20:00:00Z",
      closedBy: "Isaiah Chester",
    });
    assert.deepEqual(v, {
      status: "closed",
      closedAt: "2026-10-18T20:00:00Z",
      closedBy: "Isaiah Chester",
    });
  });
  it("badge: 'Closed' with the date, plus closedBy when present", () => {
    const at = "2026-10-18T16:00:00Z";
    assert.equal(
      closedBadgeText({ closedAt: at, closedBy: "Isaiah Chester" }),
      "Closed · Oct 18, 2026 · by Isaiah Chester",
    );
    assert.equal(closedBadgeText({ closedAt: at, closedBy: null }), "Closed · Oct 18, 2026");
    assert.equal(closedBadgeText({ closedAt: "nope", closedBy: null }), "Closed");
  });
  it("confirm wording is the contract's", () => {
    assert.equal(CLOSE_CONFIRM_TEXT, "Close this job? It becomes read-only.");
    assert.equal(JOB_CLOSED_MESSAGE, "This job is closed and can't be changed.");
  });
});

describe("closed job blocks autosave", () => {
  const base = { projectId: "p1", hydrated: true, mode: "job" };
  it("open job autosaves; closed does not", () => {
    assert.equal(canAutosave({ ...base, closed: false }), true);
    assert.equal(canAutosave({ ...base, closed: true }), false);
  });
  it("no job / not hydrated / not on the job screen → no autosave", () => {
    assert.equal(canAutosave({ ...base, projectId: null, closed: false }), false);
    assert.equal(canAutosave({ ...base, hydrated: false, closed: false }), false);
    assert.equal(canAutosave({ ...base, mode: "home", closed: false }), false);
  });
});

describe("closeProject result and error mapping (server style = archiveProject)", () => {
  it("ok → closed with closedAt/closedBy", () => {
    assert.deepEqual(
      mapCloseResult({
        ok: true,
        status: "closed",
        closedAt: "2026-10-18T20:00:00Z",
        closedBy: "Isaiah",
      }),
      { kind: "closed", closedAt: "2026-10-18T20:00:00Z", closedBy: "Isaiah" },
    );
  });
  it("idempotent: a second close is still closed", () => {
    const r = { ok: true, status: "closed", closedAt: "2026-10-18T20:00:00Z", closedBy: null };
    assert.equal(mapCloseResult(r).kind, "closed");
    assert.equal(mapCloseResult(r).kind, "closed");
  });
  it("unexpected shape → generic error, job stays open", () => {
    assert.equal(mapCloseResult(undefined).kind, "error");
    assert.equal(mapCloseResult({ ok: true, status: "open" }).kind, "error");
  });
  it("thrown Unauthorized → unauthenticated (back to login)", () => {
    assert.deepEqual(mapCloseError(new Error("Unauthorized")), { kind: "unauthenticated" });
  });
  it("thrown NOT_YOUR_JOB_MESSAGE → not-found, same as isolation", () => {
    assert.deepEqual(mapCloseError(new Error(NOT_YOUR_JOB_MESSAGE)), {
      kind: "not-found",
      message: NOT_YOUR_JOB_MESSAGE,
    });
  });
  it("thrown JOB_CLOSED_MESSAGE → closed (already closed elsewhere)", () => {
    assert.equal(mapCloseError(new Error(JOB_CLOSED_MESSAGE)).kind, "closed");
  });
  it("anything else → error with its message; empty message gets a fallback", () => {
    assert.deepEqual(mapCloseError(new Error("db down")), { kind: "error", message: "db down" });
    assert.match((mapCloseError("x") as { message: string }).message, /still open/);
  });
  it("save refusal is matched by the exported text, like NOT_YOUR_JOB_MESSAGE", () => {
    assert.equal(isJobClosedError(new Error(JOB_CLOSED_MESSAGE)), true);
    assert.equal(isJobClosedError(new Error(NOT_YOUR_JOB_MESSAGE)), false);
    assert.equal(isJobClosedError(null), false);
  });
});

describe("extractSheet JOB_CLOSED envelope", () => {
  it("fallback: bare top-level { ok:false, code:'JOB_CLOSED' } still maps to JOB_CLOSED", () => {
    assert.deepEqual(mapServerResponse({ ok: false, code: "JOB_CLOSED" }), {
      ok: false,
      code: "JOB_CLOSED",
    });
  });
  it("main path (CONTRACT 438a63b): { ok:false, error:{ code:'JOB_CLOSED', message } }, server message kept", () => {
    assert.deepEqual(
      mapServerResponse({ ok: false, error: { code: "JOB_CLOSED", message: "m" } }),
      {
        ok: false,
        code: "JOB_CLOSED",
        message: "m",
      },
    );
  });
  it("upload on a closed job → error with the closed message; no on-device fallback card", async () => {
    const s = await extractUpload({
      file: { name: "a.pdf", type: "application/pdf", size: 1000 },
      text: "x".repeat(200),
      signedIn: true,
      onDevice: async () => {
        throw new Error("must not fall back");
      },
      readBase64: async () => "QUJD",
      server: async () => ({
        ok: false,
        error: { code: "JOB_CLOSED", message: JOB_CLOSED_MESSAGE },
      }),
    });
    assert.equal(s.kind, "error");
    assert.equal(s.kind === "error" && s.issue, "JOB_CLOSED");
    assert.equal(s.kind === "error" && s.message, ISSUE_COPY.JOB_CLOSED);
    assert.equal(ISSUE_COPY.JOB_CLOSED, JOB_CLOSED_MESSAGE);
  });
});

describe("closed job: archive yes, delete no (PO ruling)", () => {
  it("closed rows hide Remove / Delete forever but keep Archive (active) or Restore (archived)", () => {
    assert.deepEqual(rowActions({ status: "closed", archived: false }), {
      open: true,
      archive: true,
      restore: false,
      remove: false,
    });
    assert.deepEqual(rowActions({ status: "closed", archived: true }), {
      open: false,
      archive: false,
      restore: true,
      remove: false,
    });
  });
  it("open rows (and older rows with no status) keep Remove", () => {
    assert.equal(rowActions({ archived: false }).remove, true);
    assert.equal(rowActions({ status: "open", archived: true }).remove, true);
  });
  it("a refused delete shows BE's JOB_CLOSED_DELETE_MESSAGE", () => {
    assert.equal(JOB_CLOSED_DELETE_MESSAGE, "This job is closed and can't be deleted.");
    assert.equal(
      deleteErrorMessage(new Error(JOB_CLOSED_DELETE_MESSAGE)),
      JOB_CLOSED_DELETE_MESSAGE,
    );
    assert.equal(deleteErrorMessage(new Error("db down")), "db down");
    assert.equal(deleteErrorMessage(undefined), "Could not remove project.");
  });
  it("closedBy shows as-is, including 'This device' for imported guest jobs", () => {
    const v = jobStatusOf({
      status: "closed",
      closedAt: "2026-10-18T16:00:00Z",
      closedBy: "This device",
    });
    assert.equal(closedBadgeText(v), "Closed · Oct 18, 2026 · by This device");
  });
});
