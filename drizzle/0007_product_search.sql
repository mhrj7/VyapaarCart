-- Run concurrently and outside a transaction for production. No extension required.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_search" ON "products" USING gin
((setweight(to_tsvector('english', "title"), 'A') || setweight(to_tsvector('english', "description"), 'B')));
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_browse" ON "products" ("status", "created_at", "id");
