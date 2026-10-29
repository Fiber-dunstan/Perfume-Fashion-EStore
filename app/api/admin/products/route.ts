import { env } from "cloudflare:workers";
import { randomUUID } from "node:crypto";
import { productInputSchema } from "@/src/schemas/store";
import { getAdmin } from "@/src/lib/admin-session";

export async function GET(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const result = await env.DB.prepare(`
    SELECT p.id, p.name, p.slug, p.description, p.price_minor,
           p.currency, p.sku, p.category_id, p.images_json,
           p.stock_quantity, p.reserved_quantity, p.low_stock_threshold,
           p.is_active, p.is_featured, p.archived_at,
           c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
  `).all();

  const products = result.results.map((row: Record<string, unknown>) => ({
    ...row,
    price: Number(row.price_minor) / 100,
    images: JSON.parse(String(row.images_json || "[]")),
  }));

  return Response.json({ products });
}

export async function POST(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid product details.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const p = parsed.data;
  const id = randomUUID();

  try {
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id = ? AND is_active = 1",
    ).bind(p.categoryId).first();

    if (!category) {
      return Response.json({ error: "Choose an active category." }, { status: 400 });
    }

    await env.DB.prepare(`
      INSERT INTO products (
        id, name, slug, description, price_minor, currency, sku,
        category_id, images_json, stock_quantity, reserved_quantity,
        low_stock_threshold, is_active, is_featured,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      id, p.name, p.slug, p.description, p.priceMinor, p.currency,
      p.sku ?? null, p.categoryId, JSON.stringify(p.images),
      p.stockQuantity, p.lowStockThreshold, p.isActive ? 1 : 0,
      p.isFeatured ? 1 : 0,
    ).run();

    return Response.json({ id, message: "Product created." }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed:", error);
    return Response.json(
      { error: "Could not create product. Check that its slug and SKU are unique." },
      { status: 409 },
    );
  }
}
