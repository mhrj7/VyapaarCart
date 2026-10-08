import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteImageOrder, maxProductImageBytes, productImageExtension } from "../lib/product-media";

test("product images enforce signature, MIME type, size, and supported formats", () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  assert.equal(productImageExtension(png, "image/png"), "png");
  assert.equal(productImageExtension(png, "image/jpeg"), null);
  assert.equal(productImageExtension(Buffer.from("<script>alert(1)</script>"), "image/png"), null);
  assert.equal(productImageExtension(new Uint8Array(), "image/png"), null);
  assert.equal(productImageExtension(new Uint8Array(maxProductImageBytes + 1), "image/png"), null);
  assert.equal(productImageExtension(Uint8Array.from([255, 216, 255]), "image/jpeg"), "jpg");
  assert.equal(productImageExtension(Buffer.from("RIFFxxxxWEBPxxxx"), "image/webp"), "webp");
  assert.equal(productImageExtension(Buffer.from("<svg/>"), "image/svg+xml"), null);
});

test("saved image order must be an exact permutation, not partial or cross-product", () => {
  assert.equal(isCompleteImageOrder(["b", "a"], ["a", "b"]), true);
  for (const input of [["a"], ["a", "a"], ["a", "foreign"], [1, "b"], "a,b", null]) assert.equal(isCompleteImageOrder(input, ["a", "b"]), false);
});
