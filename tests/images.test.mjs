import test from "node:test";
import assert from "node:assert/strict";

import { estimateDataUrlBytes } from "../images.js";

test("berechnet die ungefähre Größe gespeicherter Base64-Bilder", () => {
  assert.equal(estimateDataUrlBytes("data:image/jpeg;base64,SGVsbG8="), 5);
  assert.equal(estimateDataUrlBytes(""), 0);
});
