import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AppErrorComponent } from "./error-component.tsx";
import { routeErrorMessage as shownErrorMessage } from "./errors/public-error.ts";

const FALLBACK = "An unexpected error occurred. Try reloading the page.";

describe("route error screen (SSR / route errors)", () => {
  it("production: an internal message is replaced by the plain fallback", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:5432 at /var/task/.output/server/index.mjs:12");
    assert.equal(shownErrorMessage(err, true), FALLBACK);
  });

  it("production: allowlisted and already-sanitized (ref id) messages are shown", () => {
    assert.equal(shownErrorMessage(new Error("Project not found."), true), "Project not found.");
    const sanitized = "Something went wrong on our side. Try again. (Ref: ABCDEFGHJK)";
    assert.equal(shownErrorMessage(new Error(sanitized), true), sanitized);
  });

  it("development keeps the original message", () => {
    assert.equal(shownErrorMessage(new Error("boom in dev"), false), "boom in dev");
    assert.equal(shownErrorMessage("not an error", false), FALLBACK);
  });

  it("renders without a stack", () => {
    const err = new Error("Project not found.");
    const html = renderToStaticMarkup(<AppErrorComponent error={err} reset={() => {}} info={{ componentStack: "" }} />);
    assert.ok(html.includes("Something went wrong"));
    assert.ok(!html.includes("    at "));
  });
});
