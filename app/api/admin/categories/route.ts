import { env } from "cloudflare:workers";
import { randomUUID } from "node:crypto";
import { categoryInputSchema } from "@/src/schemas/store";
import { getAdmin } from "@/src/lib/admin-session";

export async function GET(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const result = await env.DB.prepare(`
    SELECT c.id, c.name, c.slug, c.description, c.image_url,
           c.is_active, c.created_at,
           (SELECT COUNT(*) FROM products p
            WHERE p.category_id = c.id AND p.archived_at IS NULL) AS product_count
    FROM categories c
    ORDER BY c.created_at DESC
  `).all();

  return Response.json({ categories: result.results });
}

export async function POST(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = categoryInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid category details.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, slug, description, isActive } = parsed.data;
  const id = randomUUID();

  try {
    await env.DB.prepare(`
      INSERT INTO categories
        (id, name, slug, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(id, name, slug, description, isActive ? 1 : 0).run();

    return Response.json({ id, message: "Category created." }, { status: 201 });
  } catch (error) {
    console.error("Category creation failed:", error);
    return Response.json(
      { error: "Could not create category. The name or slug may already exist." },
      { status: 409 },
    );
  }
}
