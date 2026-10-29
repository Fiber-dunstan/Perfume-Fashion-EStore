import { env } from "cloudflare:workers";
import { productInputSchema } from "@/src/schemas/store";
import { getAdmin } from "@/src/lib/admin-session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = productInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid product details.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const p = parsed.data;

  try {
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id = ? AND is_active = 1",
    ).bind(p.categoryId).first();

    if (!category) {
      return Response.json({ error: "Choose an active category." }, { status: 400 });
    }

    const result = await env.DB.prepare(`
      UPDATE products SET
        name = ?, slug = ?, description = ?, price_minor = ?, currency = ?,
        sku = ?, category_id = ?, images_json = ?, stock_quantity = ?,
        low_stock_threshold = ?, is_active = ?, is_featured = ?,
        updated_at = datetime('now')
      WHERE id = ? AND archived_at IS NULL
    `).bind(
      p.name, p.slug, p.description, p.priceMinor, p.currency,
      p.sku ?? null, p.categoryId, JSON.stringify(p.images),
      p.stockQuantity, p.lowStockThreshold,
      p.isActive ? 1 : 0, p.isFeatured ? 1 : 0, id,
    ).run();

    if (!result.meta.changes) {
      return Response.json({ error: "Product not found or archived." }, { status: 404 });
    }

    return Response.json({ message: "Product updated." });
  } catch (error) {
    console.error("Product update failed:", error);
    return Response.json(
      { error: "Could not update product. Check that its slug and SKU are unique." },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;

  const result = await env.DB.prepare(`
    UPDATE products
    SET archived_at = datetime('now'), is_active = 0,
        updated_at = datetime('now')
    WHERE id = ? AND archived_at IS NULL
  `).bind(id).run();

  if (!result.meta.changes) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  return Response.json({ message: "Product archived." });
}
