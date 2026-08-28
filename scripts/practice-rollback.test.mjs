import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FORBIDDEN_GROK,
  FORBIDDEN_MAIN,
  FORBIDDEN_PRODUCTION,
  NO_PREVIOUS,
  forbiddenPracticeTarget,
  parseDeploymentsJson,
  pickPreviousPreview,
  planPracticeRollback,
} from "./practice-rollback.mjs";

const previews = [
  { url: "https://app-git-feat-bad-team.vercel.app", target: "preview", state: "READY" },
  { url: "https://app-git-feat-good-team.vercel.app", target: "preview", state: "READY" },
  { url: "https://app-git-older-team.vercel.app", target: "preview", state: "READY" },
];

test("refuses grok.me", () => {
  assert.equal(
    forbiddenPracticeTarget({ url: "https://coatings.grok.me" }),
    FORBIDDEN_GROK,
  );
  assert.equal(
    forbiddenPracticeTarget({ url: "https://preview.grok.me/app" }),
    FORBIDDEN_GROK,
  );
});

test("refuses main", () => {
  assert.equal(
    forbiddenPracticeTarget({
      url: "https://app-git-main-team.vercel.app",
      gitBranch: "main",
      target: "preview",
    }),
    FORBIDDEN_MAIN,
  );
});

test("refuses production", () => {
  assert.equal(
    forbiddenPracticeTarget({
      url: "https://app.vercel.app",
      target: "production",
    }),
    FORBIDDEN_PRODUCTION,
  );
  const plan = planPracticeRollback({
    current: { url: "https://app.vercel.app", target: "production" },
    deployments: previews,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.command, null);
  assert.equal(plan.error, FORBIDDEN_PRODUCTION);
});

test("undo is the previous Vercel preview, not production", () => {
  const plan = planPracticeRollback({
    current: { url: "https://app-git-feat-bad-team.vercel.app", target: "preview" },
    deployments: [
      ...previews,
      { url: "https://app.vercel.app", target: "production", state: "READY" },
    ],
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.previous.url, "https://app-git-feat-good-team.vercel.app");
  assert.deepEqual(plan.command, [
    "vercel",
    "alias",
    "https://app-git-feat-good-team.vercel.app",
    "app-git-feat-bad-team.vercel.app",
  ]);
  assert.equal(plan.command.includes("--prod"), false);
  assert.equal(plan.command.includes("promote"), false);
  assert.equal(plan.command.includes("rollback"), false);
});

test("skips a missing previous preview", () => {
  const plan = planPracticeRollback({
    current: { url: "https://app-git-only-team.vercel.app", target: "preview" },
    deployments: [{ url: "https://app-git-only-team.vercel.app", target: "preview", state: "READY" }],
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.error, NO_PREVIOUS);
});

test("pickPreviousPreview walks newest-first and ignores production", () => {
  const prev = pickPreviousPreview(
    [
      { url: "https://now.vercel.app", target: "preview", state: "READY" },
      { url: "https://app.vercel.app", target: "production", state: "READY" },
      { url: "https://then.vercel.app", target: "preview", state: "READY" },
    ],
    "https://now.vercel.app",
  );
  assert.equal(prev?.url, "https://then.vercel.app");
});

test("parseDeploymentsJson accepts vercel ls --json array or wrapped object", () => {
  assert.equal(parseDeploymentsJson("[{\"url\":\"https://a.vercel.app\"}]").length, 1);
  assert.equal(
    parseDeploymentsJson('{"deployments":[{"url":"https://a.vercel.app"}]}').length,
    1,
  );
});
