import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductVariants } from "../lib/product-variants";

test("variants require a unique SKU, price, and attribute set", () => {
  assert.deepEqual(normalizeProductVariants([{ name: "Black / 128 GB", sku: "phone-black-128", price: 59999, attributes: [{ key: "Color", value: "Black" }, { key: "Storage", value: "128 GB" }] }, { name: "Blue / 256 GB", sku: "PHONE-BLUE-256", price: 64999, attributes: [{ key: "Color", value: "Blue" }, { key: "Storage", value: "256 GB" }] }]), [{ name: "Black / 128 GB", sku: "PHONE-BLACK-128", price: 59999, attributes: [{ key: "color", value: "Black" }, { key: "storage", value: "128 GB" }] }, { name: "Blue / 256 GB", sku: "PHONE-BLUE-256", price: 64999, attributes: [{ key: "color", value: "Blue" }, { key: "storage", value: "256 GB" }] }]);
});

test("variants reject duplicate SKU and invalid price", () => {
  assert.equal(normalizeProductVariants([{ name: "A", sku: "ONE", price: 1, attributes: [] }, { name: "B", sku: "one", price: 2, attributes: [] }]), null);
  assert.equal(normalizeProductVariants([{ name: "A", sku: "ONE", price: 0, attributes: [] }]), null);
});
