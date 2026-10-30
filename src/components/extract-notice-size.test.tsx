import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ExtractNotice } from "./extract-status";
import { fileTooLargeMessage, ISSUE_COPY } from "@/lib/extract-client";

describe("ExtractNotice: size refusal (P2 413)", () => {
  it("shows the limit and what to do, as an alert", () => {
    const html = renderToStaticMarkup(
      <ExtractNotice state={{ kind: "error", issue: "FILE_TOO_LARGE", message: fileTooLargeMessage(3 * 1024 * 1024) }} />,
    );
    assert.match(html, /role="alert"/);
    assert.ok(html.includes("File is over 3 MB, the upload limit on this copy."));
    assert.ok(html.includes("This file is too large for the reader. Use a smaller file."));
    assert.equal(ISSUE_COPY.FILE_TOO_LARGE, "This file is too large for the reader. Use a smaller file.");
    assert.match(html, /data-testid="size-refusal-hint"/);
  });
  it("other errors: one line, no hint", () => {
    const html = renderToStaticMarkup(<ExtractNotice state={{ kind: "error", issue: "EXTRACT_FAILED", message: "Nope." }} />);
    assert.ok(html.includes("Nope."));
    assert.doesNotMatch(html, /size-refusal-hint/);
  });
});
