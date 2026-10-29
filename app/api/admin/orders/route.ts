import { env } from "cloudflare:workers";
import { getAdmin } from "@/src/lib/admin-session";

export async function GET(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");

  const allowedStatuses = [
    "pending_confirmation", "confirmed", "processing",
    "ready_for_collection", "dispatched", "completed",
    "cancelled", "expired",
  ];

  const status = requestedStatus && allowedStatuses.includes(requestedStatus)
    ? requestedStatus
    : "";

  const ordersResult = await env.DB.prepare(`
    SELECT id, order_reference, customer_name, customer_phone,
           customer_email, fulfillment_method, delivery_address,
           customer_notes, internal_notes, status, currency,
           subtotal_minor, delivery_fee_minor, total_minor,
           payment_confirmed, created_at, updated_at
    FROM orders
    ${status ? "WHERE status = ?" : ""}
    ORDER BY created_at DESC
    LIMIT 200
  `)
    .bind(...(status ? [status] : []))
    .all();

  const orders = (ordersResult.results ?? []) as Record<string, unknown>[];

  if (orders.length === 0) {
    return Response.json({ orders: [] });
  }

  const placeholders = orders.map(() => "?").join(",");

  const itemsResult = await env.DB.prepare(`
    SELECT order_id, product_id, product_name, sku_snapshot,
           unit_price_minor, quantity, line_total_minor
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY product_name
  `)
    .bind(...orders.map((order) => String(order.id)))
    .all();

  const itemsByOrder = new Map<string, Record<string, unknown>[]>();

  for (const item of (itemsResult.results ?? []) as Record<string, unknown>[]) {
    const orderId = String(item.order_id);
    const existing = itemsByOrder.get(orderId) ?? [];
    existing.push(item);
    itemsByOrder.set(orderId, existing);
  }

  return Response.json({
    orders: orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(String(order.id)) ?? [],
    })),
  });
}
