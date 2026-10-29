import { env } from "cloudflare:workers";
import { categoryInputSchema } from "@/src/schemas/store";
import { getAdmin } from "@/src/lib/admin-session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = categoryInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid category details." }, { status: 400 });
  }

  const { name, slug, description, isActive } = parsed.data;

  try {
    const result = await env.DB.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, description = ?, is_active = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(name, slug, description, isActive ? 1 : 0, id).run();

    if (!result.meta.changes) {
      return Response.json({ error: "Category not found." }, { status: 404 });
    }

    return Response.json({ message: "Category updated." });
  } catch (error) {
    console.error("Category update failed:", error);
    return Response.json(
      { error: "Could not update category. The name or slug may already exist." },
      { status: 409 },
    );
  }
}
