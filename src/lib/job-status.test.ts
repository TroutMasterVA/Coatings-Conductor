import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertWritable,
  canAutosave,
  CLOSE_CONFIRM_TEXT,
  closeLocal,
  closedBadgeText,
  isClosed,
  isJobClosedError,
  JOB_CLOSED_MESSAGE,
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
  it("top-level { ok:false, code:'JOB_CLOSED' } (CONTRACT text) maps to JOB_CLOSED", () => {
    assert.deepEqual(mapServerResponse({ ok: false, code: "JOB_CLOSED" }), {
      ok: false,
      code: "JOB_CLOSED",
    });
  });
  it("existing { ok:false, error:{ code } } envelope also maps, server message kept", () => {
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
      server: async () => ({ ok: false, code: "JOB_CLOSED" }),
    });
    assert.equal(s.kind, "error");
    assert.equal(s.kind === "error" && s.issue, "JOB_CLOSED");
    assert.equal(s.kind === "error" && s.message, ISSUE_COPY.JOB_CLOSED);
    assert.equal(ISSUE_COPY.JOB_CLOSED, JOB_CLOSED_MESSAGE);
  });
});

describe("guest (local) workspace mirrors close + refusal", () => {
  it("closeLocal sets closed + closedAt, no closedBy; idempotent keeps first closedAt", () => {
    const p = { id: "g1", status: undefined } as {
      id: string;
      status?: "open" | "closed";
      closedAt?: string | null;
    };
    const once = closeLocal(p, "2026-10-18T20:00:00Z");
    assert.equal(once.status, "closed");
    assert.equal(once.closedAt, "2026-10-18T20:00:00Z");
    const twice = closeLocal(once, "2026-10-19T20:00:00Z");
    assert.equal(twice.closedAt, "2026-10-18T20:00:00Z");
  });
  it("assertWritable throws JOB_CLOSED_MESSAGE on a closed job only", () => {
    assert.doesNotThrow(() => assertWritable({}));
    assert.throws(() => assertWritable({ status: "closed" }), { message: JOB_CLOSED_MESSAGE });
  });
});
