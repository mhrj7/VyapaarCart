import { sql } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

const now = sql`CURRENT_TIMESTAMP::text`;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull(),
  displayName: text("display_name").notNull().default("VyapaarCart seller"),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [uniqueIndex("idx_users_clerk_id").on(table.clerkId)]);

export const listings = pgTable("listings", {
  id: text("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  city: text("city").notNull(),
  conditionLabel: text("condition_label").notNull(),
  status: text("status").notNull().default("active"),
  imageKey: text("image_key"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
}, (table) => [
  index("idx_listings_status_created_at").on(table.status, table.createdAt),
  index("idx_listings_seller_id").on(table.sellerId),
]);

export const favourites = pgTable("favourites", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [
  primaryKey({ columns: [table.userId, table.listingId] }),
  index("idx_favourites_user_created_at").on(table.userId, table.createdAt),
]);

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [
  uniqueIndex("idx_conversations_listing_buyer").on(table.listingId, table.buyerId),
  index("idx_conversations_seller_created_at").on(table.sellerId, table.createdAt),
]);

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [index("idx_messages_conversation_created_at").on(table.conversationId, table.createdAt)]);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("requested"),
  paymentMethod: text("payment_method").notNull().default("cash_on_pickup"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  shippingName: text("shipping_name"),
  shippingEmail: text("shipping_email"),
  shippingPhone: text("shipping_phone"),
  shippingAddress: text("shipping_address"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  shippingPincode: text("shipping_pincode"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
}, (table) => [
  uniqueIndex("idx_orders_listing_buyer").on(table.listingId, table.buyerId),
  index("idx_orders_seller_status").on(table.sellerId, table.status),
  index("idx_orders_buyer_status").on(table.buyerId, table.status),
]);

export const shipments = pgTable("shipments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("sandbox"),
  trackingNumber: text("tracking_number").notNull(),
  status: text("status").notNull().default("label_created"),
  eta: text("eta").notNull(),
  shiprocketShipmentId: text("shiprocket_shipment_id"),
  awbCode: text("awb_code"),
  courierName: text("courier_name"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
}, (table) => [
  uniqueIndex("idx_shipments_order_id").on(table.orderId),
  uniqueIndex("idx_shipments_tracking_number").on(table.trackingNumber),
  index("idx_shipments_status_updated_at").on(table.status, table.updatedAt),
]);

export const shipmentEvents = pgTable("shipment_events", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  message: text("message").notNull(),
  occurredAt: text("occurred_at").notNull().default(now),
}, (table) => [index("idx_shipment_events_shipment_occurred_at").on(table.shipmentId, table.occurredAt)]);

export const sellerPickupProfiles = pgTable("seller_pickup_profiles", {
  sellerId: integer("seller_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  pickupLocation: text("pickup_location").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  country: text("country").notNull().default("India"),
  updatedAt: text("updated_at").notNull().default(now),
});
