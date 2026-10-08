import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductAttributes, parseAttributeText } from "../lib/product-attributes";

test("product attributes are normalized and searchable by stable keys", () => {
  assert.deepEqual(normalizeProductAttributes([{ key: "RAM Size", value: "16 GB" }, { key: "Brand", value: "Apple" }]), [{ key: "ram_size", value: "16 GB" }, { key: "brand", value: "Apple" }]);
  assert.deepEqual(parseAttributeText("Brand=Apple, RAM Size=16 GB"), [{ key: "brand", value: "Apple" }, { key: "ram_size", value: "16 GB" }]);
});

test("product attributes reject duplicate and malformed keys", () => {
  assert.equal(normalizeProductAttributes([{ key: "Brand", value: "Apple" }, { key: "brand", value: "Other" }]), null);
  assert.equal(parseAttributeText("9invalid=one"), null);
});
