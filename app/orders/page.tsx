"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Shipment = {
  id: string;
  trackingNumber: string;
  provider: string;
  status: string;
  eta: string;
};
type ShipmentEvent = {
  id: string;
  status: string;
  message: string;
  occurredAt: string;
};
type Order = {
  order: {
    id: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
  };
  listingTitle: string;
  listingPrice: number;
  listingCity: string;
  role: "buyer" | "seller";
  deliveryConfigured: boolean;
  pickupConfigured: boolean;
  shipment: Shipment | null;
  events: ShipmentEvent[];
};
type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const nextAction: Record<string, string> = {
  label_created: "Mark handed to carrier",
  picked_up: "Mark in transit",
  in_transit: "Mark out for delivery",
  out_for_delivery: "Mark delivered",
};

export default function OrdersPage() {
  const { isSignedIn, getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [notice, setNotice] = useState("");
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken();
      return fetch(path, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    },
    [getToken],
  );
  const load = useCallback(async () => {
    if (!isSignedIn) return;
    const response = await request("/api/orders");
    const data = await response.json();
    if (response.ok) setOrders(data.orders);
  }, [isSignedIn, request]);
  useEffect(() => {
    void load();
  }, [load]);

  async function pay(orderId: string) {
    const create = await request("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplaceOrderId: orderId }),
    });
    const payment = await create.json();
    if (!create.ok) {
      setNotice(payment.error || "Could not start the test payment.");
      return;
    }
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Could not load test checkout."));
        document.body.appendChild(script);
      }).catch((error: Error) => setNotice(error.message));
    }
    if (!window.Razorpay) return;
    new window.Razorpay({
      key: payment.keyId,
      order_id: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: "VyapaarCart",
      description: `Test payment for ${payment.title}`,
      theme: { color: "#1f8a58" },
      handler: async (response: RazorpayResponse) => {
        const verify = await request("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketplaceOrderId: orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        const data = await verify.json();
        if (verify.ok) {
          setNotice("Test payment verified. No real money was charged.");
          void load();
        } else setNotice(data.error || "Payment could not be verified.");
      },
      modal: { ondismiss: () => setNotice("Test checkout closed.") },
    }).open();
  }

  async function updateOrder(id: string, status: string) {
    const response = await request(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (response.ok) {
      setNotice("Order updated.");
      void load();
    } else setNotice(data.error || "Could not update the order.");
  }
  async function createShipment(id: string) {
    const response = await request(`/api/orders/${id}/shipment`, {
      method: "POST",
    });
    const data = await response.json();
    if (response.ok) {
      setNotice(`Test shipping label created: ${data.shipment.trackingNumber}`);
      void load();
    } else setNotice(data.error || "Could not create the test shipment.");
  }
  async function advanceShipment(id: string) {
    const response = await request(`/api/shipments/${id}`, { method: "PATCH" });
    const data = await response.json();
    if (response.ok) {
      setNotice("Test tracking updated.");
      void load();
    } else setNotice(data.error || "Could not update tracking.");
  }
  async function saveDelivery(event: React.FormEvent) {
    event.preventDefault();
    if (!deliveryOrderId) return;
    const response = await request(`/api/orders/${deliveryOrderId}/delivery`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(delivery),
    });
    const data = await response.json();
    if (response.ok) {
      setNotice("Delivery address saved.");
      setDeliveryOrderId(null);
      void load();
    } else setNotice(data.error || "Could not save delivery details.");
  }

  if (!isSignedIn)
    return (
      <main className="orders">
        <Style />
        <section className="order-gate">
          <p>VYAPAARCART ORDERS</p>
          <h1>
            Simple local deals.
            <br />
            <em>No hidden payment fees.</em>
          </h1>
          <span>
            Sign in to request pickup and manage your marketplace orders.
          </span>
          <SignInButton>
            <button>Sign in to continue</button>
          </SignInButton>
          <Link href="/">← Back to marketplace</Link>
        </section>
      </main>
    );
  return (
    <main className="orders">
      <Style />
      <header>
        <a href="/" className="logo">
          V<span>yapaar</span>Cart
        </a>
        <a href="/dashboard">My listings →</a>
      </header>
      <section className="order-head">
        <p>TEST CHECKOUT + DELIVERY SANDBOX</p>
        <h1>Orders</h1>
        <span>
          Payments are verified in Razorpay test mode. Delivery uses a local
          simulator—no courier booking is created.
        </span>
      </section>
      <section className="order-list">
        {orders.length ? (
          orders.map((entry) => (
            <article key={entry.order.id}>
              <div className="order-main">
                <p className="status">
                  {entry.order.status.replaceAll("_", " ")}
                </p>
                <h2>{entry.listingTitle}</h2>
                <span>
                  ₹{entry.listingPrice.toLocaleString("en-IN")} ·{" "}
                  {entry.listingCity} ·{" "}
                  {entry.role === "buyer" ? "You’re buying" : "You’re selling"}
                </span>
                <small>
                  {entry.order.paymentStatus === "paid"
                    ? "Razorpay test payment verified"
                    : "Payment pending"}{" "}
                  · Requested{" "}
                  {new Date(entry.order.createdAt).toLocaleDateString()}
                </small>
                {entry.shipment && (
                  <div className="tracking">
                    <div>
                      <b>
                        {entry.shipment.provider ===
                        "VyapaarCart local sandbox fallback"
                          ? "VyapaarCart sandbox carrier"
                          : entry.shipment.provider}
                      </b>
                      <code>{entry.shipment.trackingNumber}</code>
                      <span>
                        {entry.shipment.status.replaceAll("_", " ")} · ETA{" "}
                        {new Date(entry.shipment.eta).toLocaleDateString()}
                      </span>
                    </div>
                    <ol>
                      {[...entry.events].reverse().map((event) => (
                        <li key={event.id}>
                          <b>{event.status.replaceAll("_", " ")}</b>
                          <span>
                            {event.message} ·{" "}
                            {new Date(event.occurredAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <div className="actions">
                {entry.role === "seller" &&
                  entry.order.status === "requested" && (
                    <button
                      onClick={() =>
                        void updateOrder(entry.order.id, "accepted")
                      }
                    >
                      Accept request
                    </button>
                  )}
                {entry.role === "buyer" &&
                  !entry.deliveryConfigured &&
                  ["requested", "accepted"].includes(entry.order.status) && (
                    <button onClick={() => setDeliveryOrderId(entry.order.id)}>
                      Add delivery address
                    </button>
                  )}
                {entry.role === "buyer" &&
                  entry.order.status === "accepted" &&
                  entry.order.paymentStatus !== "paid" && (
                    <button onClick={() => void pay(entry.order.id)}>
                      Pay with Razorpay test
                    </button>
                  )}
                {entry.role === "seller" &&
                  entry.order.status === "accepted" &&
                  entry.order.paymentStatus === "paid" &&
                  !entry.shipment &&
                  !entry.pickupConfigured && (
                    <a className="action-link" href="/shipping">
                      Set up pickup address
                    </a>
                  )}
                {entry.role === "seller" &&
                  entry.order.status === "accepted" &&
                  entry.order.paymentStatus === "paid" &&
                  !entry.shipment &&
                  entry.pickupConfigured &&
                  !entry.deliveryConfigured && (
                    <span className="action-note">
                      Waiting for buyer address
                    </span>
                  )}
                {entry.role === "seller" &&
                  entry.order.status === "accepted" &&
                  entry.order.paymentStatus === "paid" &&
                  !entry.shipment &&
                  entry.pickupConfigured &&
                  entry.deliveryConfigured && (
                    <button onClick={() => void createShipment(entry.order.id)}>
                      Create test shipment
                    </button>
                  )}
                {entry.role === "seller" &&
                  entry.shipment &&
                  nextAction[entry.shipment.status] && (
                    <button
                      onClick={() => void advanceShipment(entry.shipment!.id)}
                    >
                      {nextAction[entry.shipment.status]}
                    </button>
                  )}
                {entry.role === "buyer" &&
                  ["requested", "accepted"].includes(entry.order.status) && (
                    <button
                      className="cancel"
                      onClick={() =>
                        void updateOrder(entry.order.id, "cancelled")
                      }
                    >
                      Cancel request
                    </button>
                  )}
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            You have no pickup requests yet. Browse the marketplace to request
            one.
          </div>
        )}
        {notice && <p className="notice">{notice}</p>}
      </section>
      {deliveryOrderId && (
        <div className="delivery-layer">
          <form onSubmit={saveDelivery} className="delivery-form">
            <button
              type="button"
              className="close-delivery"
              onClick={() => setDeliveryOrderId(null)}
            >
              ×
            </button>
            <p>SHIPROCKET SANDBOX</p>
            <h2>Delivery address</h2>
            <span>Used only to create this test shipment.</span>
            <div>
              <label>
                Name
                <input
                  required
                  value={delivery.name}
                  onChange={(e) =>
                    setDelivery({ ...delivery, name: e.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={delivery.email}
                  onChange={(e) =>
                    setDelivery({ ...delivery, email: e.target.value })
                  }
                />
              </label>
            </div>
            <div>
              <label>
                Phone
                <input
                  required
                  value={delivery.phone}
                  onChange={(e) =>
                    setDelivery({ ...delivery, phone: e.target.value })
                  }
                />
              </label>
              <label>
                Pincode
                <input
                  required
                  maxLength={6}
                  value={delivery.pincode}
                  onChange={(e) =>
                    setDelivery({
                      ...delivery,
                      pincode: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Address
              <textarea
                required
                value={delivery.address}
                onChange={(e) =>
                  setDelivery({ ...delivery, address: e.target.value })
                }
              />
            </label>
            <div>
              <label>
                City
                <input
                  required
                  value={delivery.city}
                  onChange={(e) =>
                    setDelivery({ ...delivery, city: e.target.value })
                  }
                />
              </label>
              <label>
                State
                <input
                  required
                  value={delivery.state}
                  onChange={(e) =>
                    setDelivery({ ...delivery, state: e.target.value })
                  }
                />
              </label>
            </div>
            <button>Save delivery address →</button>
          </form>
        </div>
      )}
    </main>
  );
}

function Style() {
  return (
    <style>{`
.orders{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 60px}.orders header{height:82px;border-bottom:1px solid #dfe2d9;max-width:980px;margin:auto;display:flex;align-items:center;justify-content:space-between}.orders a{color:#1f8a58;text-decoration:none;font-size:13px;font-weight:700}.logo{color:#17251f!important;font-size:21px!important;letter-spacing:-1px}.logo span{color:#1f8a58}.order-head{max-width:980px;margin:auto;padding:62px 0 34px}.order-head p,.order-gate p{font:600 10px ui-monospace,monospace;letter-spacing:.13em;color:#1f8a58;margin:0 0 10px}.order-head h1,.order-gate h1{font-size:54px;line-height:.9;letter-spacing:-2.8px;margin:0 0 14px}.order-head>span,.order-gate>span{color:#68746e;font-size:14px;line-height:1.5;max-width:640px;display:block}.order-list{max-width:980px;margin:auto;display:grid;gap:13px}.order-list article{background:#fff;border:1px solid #e1e5dc;border-radius:14px;padding:22px;display:flex;gap:20px;justify-content:space-between;align-items:flex-start}.order-main{min-width:0}.status{color:#1f8a58!important;font:700 10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px!important}.order-list h2{font-size:17px;letter-spacing:-.5px;margin:0 0 6px}.order-list span,.order-list small{display:block;color:#6e7a73;font-size:12px}.order-list small{font-size:10px;margin-top:8px}.actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.actions button,.action-link,.order-gate button,.delivery-form>button:last-child{border:0;border-radius:9px;background:#17251f;color:#fff!important;padding:10px 13px;font-size:11px!important;font-weight:700;white-space:nowrap;text-decoration:none}.actions .cancel{background:#f5e5df;color:#a84d3d}.action-note{font-size:11px!important;padding:10px 0;color:#7c6750!important}.tracking{margin-top:18px;border:1px solid #d9eadf;background:#fbfffc;border-radius:10px;padding:13px;min-width:min(550px,100%)}.tracking>div{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;align-items:center}.tracking b{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#1f8a58}.tracking code{font-size:12px;font-weight:700;color:#21372b}.tracking span{grid-column:1/-1;font-size:10px}.tracking ol{list-style:none;margin:13px 0 0;padding:0;display:grid;gap:8px;border-left:1px solid #b8d9c5}.tracking li{padding-left:12px;position:relative}.tracking li:before{content:"";position:absolute;width:6px;height:6px;background:#1f8a58;border-radius:50%;left:-3px;top:4px}.tracking li b{display:block;color:#33443a;font-size:10px;text-transform:capitalize;letter-spacing:0}.tracking li span{font-size:10px;line-height:1.4}.empty{background:#fff;border:1px dashed #cfd8cf;border-radius:14px;padding:60px;text-align:center;color:#718078;font-size:13px}.notice{font-size:12px;color:#1f8a58}.order-gate{max-width:630px;text-align:center;margin:auto;padding:135px 0}.order-gate h1 em{font-family:Georgia,serif;font-weight:400}.order-gate>span{margin:0 auto 23px}.order-gate>a{display:block;margin-top:20px}.delivery-layer{position:fixed;inset:0;z-index:20;background:rgba(16,31,23,.48);display:grid;place-items:center;padding:20px}.delivery-form{position:relative;width:min(580px,100%);background:#fffdf9;border-radius:16px;padding:28px;display:grid;gap:12px;box-shadow:0 25px 60px rgba(0,0,0,.23)}.delivery-form>p{font:700 10px ui-monospace,monospace;color:#1f8a58;letter-spacing:.13em;margin:0}.delivery-form h2{font-size:30px;letter-spacing:-1.4px;margin:0}.delivery-form>span{font-size:12px;color:#6e7a73;margin-bottom:4px}.delivery-form>div{display:grid;grid-template-columns:1fr 1fr;gap:12px}.delivery-form label{display:grid;gap:6px;font-size:11px;font-weight:700}.delivery-form input,.delivery-form textarea{border:1px solid #d8ddd6;border-radius:8px;padding:10px;font:inherit;font-size:13px}.delivery-form textarea{min-height:72px;resize:vertical}.close-delivery{position:absolute;right:16px;top:13px;border:0;background:none;font-size:24px}@media(max-width:700px){.orders{padding:0 20px 30px}.order-head{padding:42px 0 25px}.order-head h1,.order-gate h1{font-size:43px;letter-spacing:-2px}.order-list article{flex-direction:column}.actions{justify-content:flex-start}.tracking{min-width:0}.orders header{height:65px}.delivery-form>div{grid-template-columns:1fr}}`}</style>
  );
}
