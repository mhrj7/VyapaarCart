CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" integer NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "favourites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"price" integer NOT NULL,
	"city" text NOT NULL,
	"condition_label" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"image_key" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"payment_method" text DEFAULT 'cash_on_pickup' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"shipping_name" text,
	"shipping_email" text,
	"shipping_phone" text,
	"shipping_address" text,
	"shipping_city" text,
	"shipping_state" text,
	"shipping_pincode" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_pickup_profiles" (
	"seller_id" integer PRIMARY KEY NOT NULL,
	"pickup_location" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"occurred_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"provider" text DEFAULT 'sandbox' NOT NULL,
	"tracking_number" text NOT NULL,
	"status" text DEFAULT 'label_created' NOT NULL,
	"eta" text NOT NULL,
	"shiprocket_shipment_id" text,
	"awb_code" text,
	"courier_name" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"display_name" text DEFAULT 'VyapaarCart seller' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_pickup_profiles" ADD CONSTRAINT "seller_pickup_profiles_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversations_listing_buyer" ON "conversations" USING btree ("listing_id","buyer_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_seller_created_at" ON "conversations" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_favourites_user_created_at" ON "favourites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_listings_status_created_at" ON "listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_listings_seller_id" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_created_at" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_listing_buyer" ON "orders" USING btree ("listing_id","buyer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_seller_status" ON "orders" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "idx_orders_buyer_status" ON "orders" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "idx_shipment_events_shipment_occurred_at" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_shipments_order_id" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_shipments_tracking_number" ON "shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "idx_shipments_status_updated_at" ON "shipments" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_clerk_id" ON "users" USING btree ("clerk_id");