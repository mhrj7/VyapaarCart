import assert from "node:assert/strict";
import test from "node:test";
import { stockInput, warehouseInput } from "../lib/warehouse-input";
test("warehouse details require bounded fields and a six-digit postcode", () => {
  assert.equal(warehouseInput({ name: "", address: "Test", city: "Test", postcode: "560001" }), null);
  assert.equal(warehouseInput({ name: "Test", address: "Test", city: "Test", postcode: "123" }), null);
  assert.equal(warehouseInput({ name: "Test", address: "Test", city: "Test", postcode: "560001" })?.name, "Test");
  assert.equal(warehouseInput({ name: "a".repeat(81), address: "Test", city: "Test", postcode: "560001" }), null);
});
test("stock requires integer bounds and an explicit optimistic version", () => {
  for (const quantity of [-1, 1.5, "4", 1000001, null]) assert.equal(stockInput({ variantId: "test", quantity, version: 0 }), null);
  assert.equal(stockInput({ variantId: "test", quantity: 0 }), null);
  assert.deepEqual(stockInput({ variantId: "test", quantity: 0, version: 0 }), { variantId: "test", quantity: 0, version: 0, reason: "Manual stock update" });
  for (const reason of ["", " ", 123, "x".repeat(241)]) assert.equal(stockInput({ variantId: "test", quantity: 4, version: 1, reason }), null);
});
