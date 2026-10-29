import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search")?.trim();
  const featured = url.searchParams.get("featured");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit")) || 12),
  );
  const offset = (page - 1) * limit;

  const conditions = [
    "p.is_active = 1",
    "p.archived_at IS NULL",
    "c.is_active = 1",
  ];
  const values: (string | number)[] = [];

  if (category) {
    conditions.push("c.slug = ?");
    values.push(category);
  }

  if (search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  if (featured === "true") {
    conditions.push("p.is_featured = 1");
  }

  const where = conditions.join(" AND ");

  const [productsResult, countResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.category_id,
        p.description,
        p.price_minor,
        p.currency,
        p.images_json,
        p.stock_quantity,
        p.is_featured,
        c.name AS category_name,
        c.slug AS category_slug
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE ${where}
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `)
      .bind(...values, limit, offset)
      .all(),

    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE ${where}
    `)
      .bind(...values)
      .first<{ total: number }>(),
  ]);

  const products = (productsResult.results ?? []).map((product) => ({
    ...product,
    price: Number(product.price_minor) / 100,
    images: JSON.parse(String(product.images_json || "[]")),
    inStock: Number(product.stock_quantity) > 0,
    stock_quantity: undefined,
    images_json: undefined,
    price_minor: undefined,
  }));

  return Response.json(
    {
      products,
      pagination: {
        page,
        limit,
        total: Number(countResult?.total ?? 0),
        totalPages: Math.ceil(Number(countResult?.total ?? 0) / limit),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
      },
    },
  );
}
