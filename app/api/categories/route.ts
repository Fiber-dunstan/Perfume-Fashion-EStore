import { env } from "cloudflare:workers";

  export async function GET() {
    console.log(
    "[D1 DEBUG] env keys:",
    Object.keys(env),
    "DB exists:",
    Boolean(env.DB),
    "DB type:",
    typeof env.DB
  );
  
  const result = await env.DB.prepare(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.description,
      c.image_url,
      COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p
      ON p.category_id = c.id
      AND p.is_active = 1
      AND p.archived_at IS NULL
    WHERE c.is_active = 1
    GROUP BY c.id, c.name, c.slug, c.description, c.image_url
    ORDER BY c.name ASC
  `).all();

  return Response.json(
    { categories: result.results ?? [] },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
      },
    },
  );
}
