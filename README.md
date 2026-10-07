# VyapaarCart

VyapaarCart is a full-stack local marketplace for buying and selling pre-owned goods. It is built as a production-style backend portfolio project: authenticated users can manage listings, upload images, save favourites, message sellers, request orders, use Razorpay test payments, and follow a local shipping workflow.

## What it demonstrates

- Next.js App Router with typed API routes
- Clerk authentication for email and social sign-in
- Neon Postgres with Drizzle ORM and relational data modelling
- Vercel Blob for image uploads and cleanup
- Buyer–seller conversations, favourites, seller dashboards, and listing lifecycle management
- Razorpay test-mode payment order creation and server-side signature verification
- Local shipping simulator with pickup profiles, shipment states, tracking events, and delivery handover
- Search, filters, sorting, shareable listing pages, Open Graph metadata, and responsive UI

## Stack

Next.js 16 · TypeScript · React 19 · Clerk · Neon Postgres · Drizzle ORM · Vercel Blob · Razorpay (test mode) · Vercel

## Run locally

1. Copy `.env.example` to `.env.local` and add your own credentials.
2. Install dependencies with `npm install`.
3. Create the database tables with `npm run db:push`.
4. Start the app with `npm run dev`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload and delete access |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client-side key |
| `CLERK_SECRET_KEY` | Clerk server-side key |
| `RAZORPAY_TEST_KEY_ID` | Razorpay test publishable key |
| `RAZORPAY_TEST_KEY_SECRET` | Razorpay test secret |

Do not commit real credentials. The app remains usable for browsing without Razorpay; sign-in, uploads, and payment verification require the related variables.

## Project notes

- Payments operate only in Razorpay test mode.
- Delivery is deliberately a local, deterministic simulator for portfolio demonstration; it does not book a real courier.
- Production service keys should be set in Vercel, never committed to the repository.
