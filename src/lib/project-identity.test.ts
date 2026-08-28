import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateProjectIdentity } from "./project-identity.ts";

describe("validateProjectIdentity", () => {
  it("requires a non-blank name", () => {
    assert.throws(() => validateProjectIdentity({ name: "   ", zip: "22902" }), {
      message: "Project name is required.",
    });
  });

  it("requires a 5-digit US ZIP after stripping non-digits", () => {
    assert.throws(() => validateProjectIdentity({ name: "Tank 3", zip: "2290" }), {
      message: "Enter a 5-digit US ZIP.",
    });
  });

  it("accepts a 5-digit ZIP and trims the name", () => {
    assert.deepEqual(validateProjectIdentity({ name: "  Tank 3  ", zip: "22902" }), {
      name: "Tank 3",
      zip: "22902",
    });
  });

  it("keeps the first five digits of a ZIP+4", () => {
    assert.equal(validateProjectIdentity({ name: "Dock", zip: "22902-1234" }).zip, "22902");
  });
});
