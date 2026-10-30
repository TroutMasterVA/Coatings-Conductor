import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hostMaxUploadMb,
  isHostTooLarge,
  uploadLimit,
  VERCEL_BODY_LIMIT_BYTES,
  VERCEL_MAX_UPLOAD_MB,
} from "./upload-limit.ts";
import { EXTRACT_DEFAULT_MAX_FILE_MB, checkRequest } from "./extract-core.ts";
import { MAX_TEXT_CHARS } from "../extract-client.ts";

describe("upload limit is honest for the host (P2 413)", () => {
  it("off Vercel: MAX_UPLOAD_MB as set, default 10", () => {
    assert.equal(uploadLimit({}, EXTRACT_DEFAULT_MAX_FILE_MB).mb, 10);
    assert.equal(uploadLimit({ MAX_UPLOAD_MB: "25" }, 10).mb, 25);
    assert.equal(uploadLimit({ MAX_UPLOAD_MB: "2.5" }, 10).mb, 2.5);
    assert.equal(hostMaxUploadMb({}), null);
  });
  it("junk MAX_UPLOAD_MB falls back to the default", () => {
    for (const v of ["", "abc", "0", "-3"]) assert.equal(uploadLimit({ MAX_UPLOAD_MB: v }, 10).mb, 10, v);
  });
  it("on Vercel: never above 3 MB, and a lower MAX_UPLOAD_MB still wins", () => {
    assert.deepEqual(uploadLimit({ VERCEL: "1" }, 10), { mb: 3, configuredMb: null, hostMb: 3, clamped: true });
    assert.deepEqual(uploadLimit({ VERCEL: "1", MAX_UPLOAD_MB: "10" }, 10), { mb: 3, configuredMb: 10, hostMb: 3, clamped: true });
    assert.deepEqual(uploadLimit({ VERCEL: "1", MAX_UPLOAD_MB: "3" }, 10), { mb: 3, configuredMb: 3, hostMb: 3, clamped: false });
    assert.deepEqual(uploadLimit({ VERCEL: "1", MAX_UPLOAD_MB: "2" }, 10), { mb: 2, configuredMb: 2, hostMb: 3, clamped: false });
  });
  it("3 MB as base64 plus the largest text payload fits under the measured 4.5 MB cap", () => {
    const b64 = Math.ceil((VERCEL_MAX_UPLOAD_MB * 1024 * 1024) / 3) * 4;
    // text + pages (each ≤ 40,000 chars; up to 3 UTF-8 bytes per char) + 8 KB framing/headers.
    const worst = b64 + 2 * MAX_TEXT_CHARS * 3 + 8 * 1024;
    assert.ok(worst < VERCEL_BODY_LIMIT_BYTES, `${worst} >= ${VERCEL_BODY_LIMIT_BYTES}`);
    // One step up (3.5 MB) would not fit even without text: the limit is not set too low by much.
    assert.ok(Math.ceil((3.5 * 1024 * 1024) / 3) * 4 > VERCEL_BODY_LIMIT_BYTES);
  });
  it("the server refuses over the Vercel limit with the coded, named message", () => {
    const max = VERCEL_MAX_UPLOAD_MB * 1024 * 1024;
    const r = checkRequest({ fileBase64: "A".repeat(Math.ceil(max / 3) * 4 + 8), mimeType: "application/pdf", fileName: "a.pdf" }, max);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "FILE_TOO_LARGE");
      assert.equal(r.message, "File is over 3 MB, the upload limit on this copy.");
    }
  });
});

describe("isHostTooLarge", () => {
  it("knows Vercel's JSON and text 413 replies", () => {
    assert.equal(isHostTooLarge({ code: "413", message: "Request Entity Too Large" }), true);
    assert.equal(isHostTooLarge({ error: { code: "413", message: "Request Entity Too Large" } }), true);
    assert.equal(isHostTooLarge(new Error("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\niad1::abc")), true);
    assert.equal(isHostTooLarge({ status: 413 }), true);
    assert.equal(isHostTooLarge("413 Payload Too Large"), true);
  });
  it("does not treat other failures as size", () => {
    for (const v of [null, undefined, "", "x", new Error("Could not read this sheet."), { code: "EXTRACT_FAILED", message: "x" }, { status: 500 }]) {
      assert.equal(isHostTooLarge(v), false, String(v));
    }
  });
});
