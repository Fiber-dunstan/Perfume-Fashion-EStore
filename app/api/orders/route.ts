import { env } from "cloudflare:workers";
import { randomUUID } from "node:crypto";
import { checkoutInputSchema } from "@/src/schemas/store";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  price_minor: number;
  stock_quantity: number;
  reserved_quantity: number;
  is_active: number;
  archived_at: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Please check your details and try again.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Combine duplicate product IDs so quantities and totals stay consistent.
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity,
    );
  }

  if ([...quantities.values()].some((quantity) => quantity > 100)) {
    return Response.json(
      { error: "The quantity of an individual product cannot exceed 100." },
      { status: 400 },
    );
  }

  try {
    // A retry with the same key returns the original order instead of duplicating it.
    const existing = await env.DB.prepare(`
      SELECT id, order_reference, status
      FROM orders
      WHERE idempotency_key = ?
      LIMIT 1
    `).bind(input.idempotencyKey).first<{
      id: string;
      order_reference: string;
      status: string;
    }>();

    if (existing) {
      return Response.json({
        success: true,
        orderReference: existing.order_reference,
        status: existing.status,
      });
    }

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");

    const result = await env.DB.prepare(`
      SELECT id, name, sku, price_minor, stock_quantity,
             reserved_quantity, is_active, archived_at
      FROM products
      WHERE id IN (${placeholders})
    `).bind(...ids).all<ProductRow>();

    const productMap = new Map(
      (result.results ?? []).map((product) => [product.id, product]),
    );

    let subtotal = 0;
    const items = [];

    for (const [productId, quantity] of quantities) {
      const product = productMap.get(productId);

      if (
        !product ||
        product.is_active !== 1 ||
        product.archived_at ||
        product.stock_quantity - product.reserved_quantity < quantity
      ) {
        return Response.json(
          { error: "One or more products are unavailable or have insufficient stock. Please return to the store and review your bag." },
          { status: 409 },
        );
      }

      const lineTotal = Number(product.price_minor) * quantity;
      if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) {
        return Response.json({ error: "A product price is invalid." }, { status: 400 });
      }

      subtotal += lineTotal;
      items.push({ product, quantity, lineTotal });
    }

    if (!Number.isSafeInteger(subtotal) || subtotal > 2_000_000_000) {
      return Response.json({ error: "The order total is too large." }, { status: 400 });
    }

    const orderId = randomUUID();
    const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const orderReference = `ORD-${Date.now().toString(36).toUpperCase()}-${suffix}`;
    const deliveryFee = 0;

    // The fee is deliberately zero here: delivery costs are confirmed by phone.
    // Stock conditions are checked again inside the same atomic D1 batch.
    const stockConditions = items.map(
      () => `EXISTS (
        SELECT 1 FROM products
        WHERE id = ? AND is_active = 1 AND archived_at IS NULL
          AND stock_quantity - reserved_quantity >= ?
      )`,
    );

    const orderStatement = env.DB.prepare(`
      INSERT INTO orders (
        id, order_reference, idempotency_key, customer_name, customer_phone,
        customer_email, fulfillment_method, delivery_address, customer_notes,
        status, currency, subtotal_minor, delivery_fee_minor, total_minor
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?,
             'pending_confirmation', 'GHS', ?, ?, ?
      WHERE ${stockConditions.join(" AND ")}
    `).bind(
      orderId,
      orderReference,
      input.idempotencyKey,
      input.customerName,
      input.customerPhone,
      input.customerEmail || null,
      input.fulfillmentMethod,
      input.fulfillmentMethod === "delivery" ? input.deliveryAddress.trim() : null,
      input.notes,
      subtotal,
      deliveryFee,
      subtotal + deliveryFee,
      ...items.flatMap((item) => [item.product.id, item.quantity]),
    );

    // D1 batch executes these statements transactionally.
    const statements = [orderStatement];

    for (const item of items) {
      statements.push(env.DB.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name, sku_snapshot,
          unit_price_minor, quantity, line_total_minor
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?)
      `).bind(
        randomUUID(),
        orderId,
        item.product.id,
        item.product.name,
        item.product.sku,
        Number(item.product.price_minor),
        item.quantity,
        item.lineTotal,
        orderId,
      ));
    }

    for (const item of items) {
      statements.push(env.DB.prepare(`
        UPDATE products
        SET reserved_quantity = reserved_quantity + ?,
            updated_at = datetime('now')
        WHERE id = ?
          AND EXISTS (SELECT 1 FROM orders WHERE id = ?)
      `).bind(item.quantity, item.product.id, orderId));
    }

    await env.DB.batch(statements);

    const saved = await env.DB.prepare(`
      SELECT order_reference, status
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).bind(orderId).first<{ order_reference: string; status: string }>();

    if (!saved) {
      // Another order may have taken the stock just before this order was saved.
      const retry = await env.DB.prepare(`
        SELECT order_reference, status
        FROM orders
        WHERE idempotency_key = ?
        LIMIT 1
      `).bind(input.idempotencyKey).first<{
        order_reference: string;
        status: string;
      }>();

      if (retry) {
        return Response.json({
          success: true,
          orderReference: retry.order_reference,
          status: retry.status,
        });
      }

      return Response.json(
        { error: "Stock availability changed while placing your order. Please review your bag and try again." },
        { status: 409 },
      );
    }

    return Response.json(
      {
        success: true,
        orderReference: saved.order_reference,
        status: saved.status,
        message: "Your order has been received. We will contact you to confirm availability, delivery details and payment.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Order submission failed:", error);
    return Response.json(
      { error: "We could not submit your order right now. Please try again." },
      { status: 500 },
    );
  }
}
