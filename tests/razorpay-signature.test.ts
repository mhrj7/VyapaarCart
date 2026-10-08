import assert from "node:assert/strict";
import test from "node:test";
import {
  createRazorpaySignature,
  verifyRazorpaySignature,
} from "../lib/razorpay-signature";

const secret = "razorpay-test-secret";
const orderId = "order_test_123";
const paymentId = "pay_test_456";

test("accepts a valid Razorpay payment signature", async () => {
  const signature = await createRazorpaySignature(orderId, paymentId, secret);
  assert.equal(
    await verifyRazorpaySignature(orderId, paymentId, signature, secret),
    true,
  );
});

test("rejects a tampered Razorpay payment signature", async () => {
  const signature = await createRazorpaySignature(orderId, paymentId, secret);
  const tampered = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
  assert.equal(
    await verifyRazorpaySignature(orderId, paymentId, tampered, secret),
    false,
  );
});
