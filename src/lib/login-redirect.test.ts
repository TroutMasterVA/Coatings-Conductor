import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loginNavigatesHome } from "./login-redirect.ts";

describe("leaving /login takes one path (BUG-51-1: carry-over pop-up twice after email sign-in)", () => {
  it("already signed in on arrival: the router sends them home", () => {
    assert.equal(loginNavigatesHome({ user: { id: "u1" }, submitting: false }), true);
  });
  it("signed in by this page's submit: no router redirect, the handler's single page load does it", () => {
    assert.equal(loginNavigatesHome({ user: { id: "u1" }, submitting: true }), false);
  });
  it("signed out: stays on /login", () => {
    assert.equal(loginNavigatesHome({ user: null, submitting: false }), false);
    assert.equal(loginNavigatesHome({ user: null, submitting: true }), false);
  });
  it("login.tsx uses the guard with its submit flag, and sign-in and sign-up share the one full-page load home", () => {
    const src = readFileSync(new URL("../routes/login.tsx", import.meta.url), "utf8");
    const navigates = src.match(/<Navigate\b[^>]*>/g) ?? [];
    assert.equal(navigates.length, 1, "one router redirect");
    assert.match(src, /if \(loginNavigatesHome\(\{ user, submitting: busy \}\)\) return <Navigate to="\/" \/>;/);
    assert.equal((src.match(/window\.location\.(href\s*=|assign|replace)/g) ?? []).length, 1, "one page load, after either submit");
    // busy is set before the auth call and only cleared on failure, so a successful submit never
    // lets the router redirect race the page load.
    const handler = src.slice(src.indexOf("async function handleEmail"), src.indexOf("return (", src.indexOf("async function handleEmail")));
    assert.ok(handler.indexOf("setBusy(true)") < handler.indexOf("authClient.sign"), "busy before sign-in/up");
    assert.equal((handler.match(/setBusy\(false\)/g) ?? []).length, 1, "busy cleared only in the error path");
    assert.ok(handler.indexOf("setBusy(false)") > handler.indexOf("catch"), "busy cleared in catch");
  });
});
