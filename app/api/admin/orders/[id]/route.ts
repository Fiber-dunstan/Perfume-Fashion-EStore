import { env } from "cloudflare:workers";
import { getAdmin } from "@/src/lib/admin-session";

const statuses = [
  "pending_confirmation",
  "confirmed",
  "processing",
  "ready_for_collection",
  "dispatched",
  "completed",
  "cancelled",
  "expired",
] as const;

const terminalStatuses = ["completed", "cancelled", "expired"];

export async function PATCH(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);

  if (!id || id === "orders") {
    return Response.json({ error: "Invalid order ID." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  if (input.status !== undefined &&
      (typeof input.status !== "string" ||
       !statuses.includes(input.status as typeof statuses[number]))) {
    return Response.json({ error: "Invalid order status." }, { status: 400 });
  }

  if (input.internalNotes !== undefined &&
      (typeof input.internalNotes !== "string" || input.internalNotes.length > 4000)) {
    return Response.json({ error: "Internal notes must be under 4,000 characters." }, { status: 400 });
  }

  if (input.paymentConfirmed !== undefined &&
      typeof input.paymentConfirmed !== "boolean") {
    return Response.json({ error: "Invalid payment confirmation value." }, { status: 400 });
  }

  if (input.deliveryFeeMinor !== undefined &&
      (!Number.isSafeInteger(input.deliveryFeeMinor) ||
       Number(input.deliveryFeeMinor) < 0 ||
       Number(input.deliveryFeeMinor) > 100_000_000)) {
    return Response.json({ error: "Enter a valid delivery fee." }, { status: 400 });
  }

  const current = await env.DB.prepare(`
    SELECT id, status, subtotal_minor, delivery_fee_minor,
           payment_confirmed
    FROM orders
    WHERE id = ?
  `).bind(id).first<Record<string, unknown>>();

  if (!current) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  const oldStatus = String(current.status);
  const nextStatus = input.status === undefined
    ? oldStatus
    : String(input.status);

  if (
    nextStatus !== oldStatus &&
    terminalStatuses.includes(oldStatus)
  ) {
    return Response.json({
      error: "Completed, cancelled, or expired orders cannot be reopened. Create a new order if necessary.",
    }, { status: 409 });
  }

  const fee = input.deliveryFeeMinor === undefined
    ? Number(current.delivery_fee_minor)
    : Number(input.deliveryFeeMinor);

  const subtotal = Number(current.subtotal_minor);
  const paymentConfirmed = input.paymentConfirmed === undefined
    ? Number(current.payment_confirmed)
    : input.paymentConfirmed ? 1 : 0;

  const internalNotes = input.internalNotes === undefined
    ? null
    : String(input.internalNotes);

  const statements = [
    env.DB.prepare(`
      UPDATE orders
      SET status = ?,
          delivery_fee_minor = ?,
          total_minor = subtotal_minor + ?,
          payment_confirmed = ?,
          internal_notes = COALESCE(?, internal_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      nextStatus,
      fee,
      fee,
      paymentConfirmed,
      internalNotes,
      id,
    ),
  ];

  if (nextStatus !== oldStatus && nextStatus === "cancelled") {
    statements.push(
      env.DB.prepare(`
        UPDATE products
        SET reserved_quantity = MAX(0, reserved_quantity - (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          WHERE oi.order_id = ? AND oi.product_id = products.id
        )),
        updated_at = datetime('now')
        WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)
      `).bind(id, id),
    );
  }

  if (nextStatus !== oldStatus && nextStatus === "completed") {
    const items = await env.DB.prepare(`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = ?
    `).bind(id).all<{ product_id: string; quantity: number }>();

    for (const item of items.results ?? []) {
      statements.push(
        env.DB.prepare(`
          UPDATE products
          SET stock_quantity = MAX(0, stock_quantity - ?),
              reserved_quantity = MAX(0, reserved_quantity - ?),
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(item.quantity, item.quantity, item.product_id),
      );
    }
  }

  try {
    await env.DB.batch(statements);
    return Response.json({
      message: "Order updated successfully.",
      orderId: id,
      status: nextStatus,
      totalMinor: subtotal + fee,
    });
  } catch (error) {
    console.error("Order update failed:", error);
    return Response.json({ error: "Could not update this order." }, { status: 500 });
  }
}
