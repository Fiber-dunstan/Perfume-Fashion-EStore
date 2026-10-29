"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  price?: number;
  price_minor?: number;
  images?: Array<{ url?: string; alt?: string }>;
};

type CartItem = {
  product: Product;
  quantity: number;
};

const currency = (amount: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(amount);

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"delivery" | "collection">("delivery");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderReference, setOrderReference] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("perfume-fashion-store-cart");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed as CartItem[]);
      }
    } catch {
      localStorage.removeItem("perfume-fashion-store-cart");
    } finally {
      setReady(true);
    }
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => {
      const price = typeof item.product.price === "number"
        ? item.product.price
        : (item.product.price_minor ?? 0) / 100;
      return sum + price * item.quantity;
    }, 0),
    [cart],
  );

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!cart.length) {
      setError("Your shopping bag is empty. Return to the store and add a product first.");
      return;
    }

    setBusy(true);
    const key = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(key);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          fulfillmentMethod,
          deliveryAddress,
          notes,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          idempotencyKey: key,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "We could not submit your order. Please try again.");
        return;
      }

      setOrderReference(data.orderReference);
      setCart([]);
      localStorage.removeItem("perfume-fashion-store-cart");
    } catch {
      setError("A connection problem prevented submission. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    marginTop: 7,
    border: "1px solid #d9d4cf",
    borderRadius: 9,
    background: "#fff",
    color: "#24201d",
    font: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 17,
    color: "#38312c",
    fontSize: 14,
    fontWeight: 600,
  };

  if (!ready) {
    return <main style={{ maxWidth: 760, margin: "60px auto", padding: 24 }}>Loading checkout…</main>;
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px", color: "#28231f" }}>
      <a href="/" style={{ color: "inherit" }}>← Back to store</a>

      {orderReference ? (
        <section style={{ maxWidth: 620, margin: "54px auto", padding: 30, border: "1px solid #e7e0d9", borderRadius: 18 }}>
          <p style={{ letterSpacing: 2, fontSize: 12 }}>ORDER RECEIVED</p>
          <h1 style={{ fontSize: 32, margin: "12px 0" }}>Thank you for your order.</h1>
          <p>Your order has been saved successfully. We will contact you by phone to confirm availability, delivery arrangements and the final amount before payment.</p>
          <p style={{ marginTop: 24 }}>Your order reference</p>
          <strong style={{ fontSize: 22 }}>{orderReference}</strong>
          <p style={{ color: "#71675e", fontSize: 14 }}>No online payment has been taken. Please wait for our confirmation.</p>
          <a href="/" style={{ display: "inline-block", marginTop: 14, padding: "12px 18px", background: "#28231f", color: "#fff", borderRadius: 9, textDecoration: "none" }}>Continue shopping</a>
        </section>
      ) : (
        <>
          <header style={{ margin: "32px 0" }}>
            <p style={{ letterSpacing: 2, fontSize: 12 }}>ALMOST YOURS</p>
            <h1 style={{ fontSize: "clamp(30px, 5vw, 44px)", margin: "8px 0" }}>Checkout</h1>
            <p style={{ color: "#71675e" }}>Share your details and we’ll contact you to confirm your order before payment.</p>
          </header>

          {!cart.length ? (
            <section style={{ padding: 28, border: "1px solid #e7e0d9", borderRadius: 14 }}>
              <h2>Your shopping bag is empty.</h2>
              <p>Add products to your bag before checking out.</p>
              <a href="/" style={{ color: "inherit" }}>Browse the store →</a>
            </section>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 32, alignItems: "start" }}>
              <form onSubmit={submitOrder} style={{ padding: 24, border: "1px solid #e7e0d9", borderRadius: 16 }}>
                <h2 style={{ marginTop: 0 }}>Your contact details</h2>

                <label style={labelStyle}>
                  Full name *
                  <input style={fieldStyle} required minLength={2} maxLength={150} autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </label>

                <label style={labelStyle}>
                  Phone number *
                  <input style={fieldStyle} required type="tel" autoComplete="tel" minLength={8} maxLength={20} placeholder="e.g. 024 123 4567" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </label>

                <label style={labelStyle}>
                  Email (optional)
                  <input style={fieldStyle} type="email" autoComplete="email" maxLength={254} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </label>

                <h2>How would you like to receive your order?</h2>

                <label style={{ ...labelStyle, fontWeight: 400 }}>
                  <input type="radio" name="fulfillment" checked={fulfillmentMethod === "delivery"} onChange={() => setFulfillmentMethod("delivery")} />{" "}
                  Delivery — we’ll confirm the delivery fee by phone
                </label>

                <label style={{ ...labelStyle, fontWeight: 400 }}>
                  <input type="radio" name="fulfillment" checked={fulfillmentMethod === "collection"} onChange={() => setFulfillmentMethod("collection")} />{" "}
                  Collection — confirm collection arrangements with us
                </label>

                {fulfillmentMethod === "delivery" && (
                  <label style={labelStyle}>
                    Delivery address and area *
                    <textarea style={{ ...fieldStyle, minHeight: 100, resize: "vertical" }} required maxLength={1000} autoComplete="street-address" placeholder="Enter your area, town and delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                  </label>
                )}

                <label style={labelStyle}>
                  Additional notes (optional)
                  <textarea style={{ ...fieldStyle, minHeight: 85, resize: "vertical" }} maxLength={2000} placeholder="Product preferences or delivery instructions" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>

                {error && <p role="alert" style={{ color: "#a32626", marginBottom: 16 }}>{error}</p>}

                <button type="submit" disabled={busy} style={{ width: "100%", border: 0, borderRadius: 10, padding: 15, background: busy ? "#8b8178" : "#28231f", color: "#fff", font: "inherit", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {busy ? "Submitting your order…" : "Place order — pay after confirmation"}
                </button>
                <p style={{ fontSize: 12, color: "#71675e", lineHeight: 1.6 }}>Submitting this order does not take payment. We’ll confirm product availability, delivery costs and payment arrangements with you by phone.</p>
              </form>

              <aside style={{ padding: 24, border: "1px solid #e7e0d9", borderRadius: 16 }}>
                <h2 style={{ marginTop: 0 }}>Your order</h2>
                {cart.map((item) => {
                  const price = typeof item.product.price === "number"
                    ? item.product.price
                    : (item.product.price_minor ?? 0) / 100;
                  return (
                    <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid #eee8e2" }}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <div style={{ color: "#71675e", fontSize: 13 }}>Qty: {item.quantity}</div>
                      </div>
                      <span style={{ whiteSpace: "nowrap" }}>{currency(price * item.quantity)}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 22 }}>
                  <strong>Subtotal</strong><strong>{currency(subtotal)}</strong>
                </div>
                <p style={{ color: "#71675e", fontSize: 13, lineHeight: 1.6 }}>Delivery fees, availability and the final amount will be confirmed before payment.</p>
              </aside>
            </div>
          )}
        </>
      )}
    </main>
  );
}
