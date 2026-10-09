import { notFound } from "next/navigation";
import Link from "next/link";
import { checkoutItem } from "../../lib/reservation-service";
import Checkout from "./reservation-checkout";
export const dynamic = "force-dynamic";
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ variant?: string; reservation?: string }> }) {
  const params = await searchParams;
  const item = await checkoutItem(params.variant ?? "");
  if (!item) notFound();
  return <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}><Link href={`/stores/${item.slug}`}>← Back to store</Link><h1>Checkout · reserve stock</h1><p>Reserve your selected SKU for 10 minutes. No payment is taken and no order is confirmed at this stage.</p><Checkout item={item} reservationId={params.reservation} /></main>;
}
