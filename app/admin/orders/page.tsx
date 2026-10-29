"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrderItem = {
  product_id: string;
  product_name: string;
  sku_snapshot: string | null;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
};

type Order = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfillment_method: "delivery" | "collection";
  delivery_address: string | null;
  customer_notes: string;
  internal_notes: string;
  status: string;
  currency: string;
  subtotal_minor: number;
  delivery_fee_minor: number;
  total_minor: number;
  payment_confirmed: number;
  created_at: string;
  items: OrderItem[];
};

type Draft = {
  status: string;
  internalNotes: string;
  paymentConfirmed: boolean;
  deliveryFee: string;
};

const statusOptions = [
  ["pending_confirmation", "Pending confirmation"],
  ["confirmed", "Confirmed"],
  ["processing", "Processing"],
  ["ready_for_collection", "Ready for collection"],
  ["dispatched", "Dispatched"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
];

function money(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(Number(minor || 0) / 100);
}

function dateLabel(value: string) {
  const date = new Date(value.includes("Z") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const auth = await fetch("/api/admin/me", { credentials: "same-origin" });

      if (!auth.ok) {
        router.replace("/admin/login");
        return;
      }

      const query = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const response = await fetch(`/api/admin/orders${query}`, {
        credentials: "same-origin",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load orders.");
      }

      const loadedOrders: Order[] = data.orders ?? [];
      setOrders(loadedOrders);

      const nextDrafts: Record<string, Draft> = {};
      for (const order of loadedOrders) {
        nextDrafts[order.id] = {
          status: order.status,
          internalNotes: order.internal_notes || "",
          paymentConfirmed: Number(order.payment_confirmed) === 1,
          deliveryFee: (Number(order.delivery_fee_minor || 0) / 100).toFixed(2),
        };
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(id: string, changes: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...changes },
    }));
  }

  async function saveOrder(order: Order) {
    const draft = drafts[order.id];
    if (!draft) return;

    const fee = Number(draft.deliveryFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1_000_000) {
      setError(`Enter a valid delivery fee for ${order.order_reference}.`);
      return;
    }

    if (
      draft.status !== order.status &&
      ["completed", "cancelled", "expired"].includes(order.status)
    ) {
      setError("A completed, cancelled, or expired order cannot be reopened.");
      return;
    }

    if (
      draft.status === "cancelled" &&
      order.status !== "cancelled" &&
      !window.confirm(`Cancel order ${order.order_reference}? Its reserved stock will be released.`)
    ) {
      return;
    }

    if (
      draft.status === "completed" &&
      order.status !== "completed" &&
      !window.confirm(`Mark ${order.order_reference} as completed? Its reserved stock will be deducted from inventory.`)
    ) {
      return;
    }

    setBusyId(order.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          internalNotes: draft.internalNotes,
          paymentConfirmed: draft.paymentConfirmed,
          deliveryFeeMinor: Math.round(fee * 100),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update order.");

      setMessage(`Order ${order.order_reference} updated.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order.");
    } finally {
      setBusyId("");
    }
  }

  const pendingCount = orders.filter((order) => order.status === "pending_confirmation").length;

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="eyebrow">STORE MANAGEMENT</p>
          <h1>Customer orders</h1>
          <p>Review orders, contact customers, confirm delivery fees and manage fulfilment.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="secondary-button" onClick={() => router.push("/admin")}>
            Products dashboard
          </button>
          <button type="button" className="secondary-button" onClick={() => void load()}>
            Refresh orders
          </button>
        </div>
      </header>

      {message && <p className="admin-success" role="status">{message}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-panel">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2>Orders received</h2>
            <p className="admin-muted">
              {orders.length} order{orders.length === 1 ? "" : "s"} shown
              {filter === "all" ? " (up to the latest 200)" : ""}
              {pendingCount > 0 ? ` · ${pendingCount} awaiting confirmation` : ""}
            </p>
          </div>
          <label>
            Filter orders
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading && <section className="admin-panel"><p>Loading orders…</p></section>}

      {!loading && orders.length === 0 && (
        <section className="admin-panel">
          <h2>No orders found</h2>
          <p className="admin-muted">
            Orders submitted through checkout will appear here once they are saved successfully.
          </p>
        </section>
      )}

      {!loading && orders.map((order) => {
        const draft = drafts[order.id];
        const terminal = ["completed", "cancelled", "expired"].includes(order.status);

        return (
          <section className="admin-panel" key={order.id}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p className="eyebrow">ORDER REFERENCE</p>
                <h2>{order.order_reference}</h2>
                <p className="admin-muted">{dateLabel(order.created_at)}</p>
              </div>
              <div>
                <p><strong>{money(order.total_minor)}</strong></p>
                <p className="admin-muted">
                  {order.payment_confirmed ? "Payment confirmed" : "Payment not confirmed"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 16 }}>
              <div>
                <h3>Customer details</h3>
                <p><strong>{order.customer_name}</strong></p>
                <p><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p>
                {order.customer_email && <p><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></p>}
                <p className="admin-muted">
                  {order.fulfillment_method === "delivery" ? "Delivery" : "Collection"}
                </p>
                {order.fulfillment_method === "delivery" && (
                  <p>{order.delivery_address || "No address provided"}</p>
                )}
                {order.customer_notes && (
                  <p><strong>Customer note:</strong> {order.customer_notes}</p>
                )}
              </div>

              <div>
                <h3>Items ordered</h3>
                {order.items.map((item, index) => (
                  <div key={`${item.product_id}-${index}`} style={{ padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                    <p><strong>{item.product_name}</strong></p>
                    <p className="admin-muted">
                      Qty: {item.quantity} × {money(item.unit_price_minor)} = {money(item.line_total_minor)}
                    </p>
                    {item.sku_snapshot && <p className="admin-muted">SKU: {item.sku_snapshot}</p>}
                  </div>
                ))}
                <p style={{ marginTop: 12 }}>Subtotal: <strong>{money(order.subtotal_minor)}</strong></p>
                <p>Delivery fee: <strong>{money(order.delivery_fee_minor)}</strong></p>
                <p>Total: <strong>{money(order.total_minor)}</strong></p>
              </div>
            </div>

            {draft && (
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
                <h3>Manage this order</h3>
                <div className="admin-form">
                  <label>
                    Order status
                    <select
                      value={draft.status}
                      disabled={terminal}
                      onChange={(event) => updateDraft(order.id, { status: event.target.value })}
                    >
                      {statusOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Confirmed delivery fee (GHS)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.deliveryFee}
                      onChange={(event) => updateDraft(order.id, { deliveryFee: event.target.value })}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={draft.paymentConfirmed}
                      onChange={(event) => updateDraft(order.id, { paymentConfirmed: event.target.checked })}
                    />
                    Payment received and confirmed
                  </label>

                  <label>
                    Internal notes (only for the store)
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={draft.internalNotes}
                      onChange={(event) => updateDraft(order.id, { internalNotes: event.target.value })}
                      placeholder="e.g. Customer called; delivery fee agreed; payment method confirmed."
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => void saveOrder(order)}
                >
                  {busyId === order.id ? "Saving…" : "Save order changes"}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
