import assert from "node:assert/strict";
import test from "node:test";
import { reservationInput } from "../lib/reservation-service";
test("reservation request accepts only bounded integer quantities and server-owned price/expiry", () => {
  const input = { variantId: "sku-1", quantity: 1, key: crypto.randomUUID() };
  assert.deepEqual(reservationInput(input), input);
  for (const quantity of [0, -1, 21, 1.2, "1", NaN]) assert.equal(reservationInput({ ...input, quantity }), null);
  assert.equal(reservationInput({ ...input, price: 1 }), null);
  assert.equal(reservationInput({ ...input, expiresAt: "2099-01-01" }), null);
  assert.equal(reservationInput({ ...input, key: "short" }), null);
  assert.equal(reservationInput(null), null);
});
