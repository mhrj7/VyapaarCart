import assert from "node:assert/strict";
import test from "node:test";
import { canBuy, canManageOwnRecord, canManageSeller, sellerAccountId, type Actor } from "../lib/authorization";

const buyer: Actor = { id: 1, clerkId: "buyer", role: "buyer", staffForSellerId: null };
const seller: Actor = { id: 2, clerkId: "seller", role: "seller", staffForSellerId: null };
const staff: Actor = { id: 3, clerkId: "staff", role: "seller_staff", staffForSellerId: 2 };
const admin: Actor = { id: 4, clerkId: "admin", role: "admin", staffForSellerId: null };

test("seller staff can manage only their assigned seller account", () => {
  assert.equal(sellerAccountId(staff), 2);
  assert.equal(canManageSeller(staff, 2), true);
  assert.equal(canManageSeller(staff, 9), false);
  assert.equal(canManageSeller(buyer, 2), false);
  assert.equal(canManageSeller(admin, 9), true);
});

test("buyer permissions and personal ownership rules are explicit", () => {
  assert.equal(canBuy(buyer), true);
  assert.equal(canBuy(seller), true);
  assert.equal(canBuy(staff), false);
  assert.equal(canManageOwnRecord(buyer, 1), true);
  assert.equal(canManageOwnRecord(buyer, 2), false);
  assert.equal(canManageOwnRecord(admin, 2), true);
});
