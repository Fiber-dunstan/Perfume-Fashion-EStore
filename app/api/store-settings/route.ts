import { env } from "cloudflare:workers";

export async function GET() {
  try {
    const result = await env.DB.prepare(`
      SELECT shop_name, tagline, description, phone, whatsapp,
             delivery_info, logo_url
      FROM store_settings
      WHERE id = 'default'
    `).first();

    return Response.json(result ?? {
      shop_name: "YOUR STORE",
      tagline: "STYLE · SCENT · EVERYDAY",
      description: "Explore fragrances, fashion, accessories and everyday essentials.",
      phone: "",
      whatsapp: "",
      delivery_info: "",
      logo_url: "",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not load shop settings." },
      { status: 500 },
    );
  }
}
