import { env } from "cloudflare:workers";
import { getAdmin } from "@/src/lib/admin-session";

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const settings = await env.DB.prepare(`
    SELECT shop_name, tagline, description, phone, whatsapp,
           delivery_info, logo_url
    FROM store_settings
    WHERE id = 'default'
  `).first();

  return Response.json(settings ?? {});
}

export async function PUT(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const settings = {
    shop_name: text(body.shop_name, 100),
    tagline: text(body.tagline, 160),
    description: text(body.description, 1000),
    phone: text(body.phone, 40),
    whatsapp: text(body.whatsapp, 40),
    delivery_info: text(body.delivery_info, 1500),
    logo_url: text(body.logo_url, 1000),
  };

  if (!settings.shop_name) {
    return Response.json({ error: "Shop name is required." }, { status: 400 });
  }

  if (settings.logo_url) {
    try {
      const url = new URL(settings.logo_url);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      return Response.json(
        { error: "Logo URL must be a valid HTTPS URL." },
        { status: 400 },
      );
    }
  }

  try {
    await env.DB.prepare(`
      INSERT INTO store_settings (
        id, shop_name, tagline, description, phone, whatsapp,
        delivery_info, logo_url, updated_at
      ) VALUES (
        'default', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        shop_name = excluded.shop_name,
        tagline = excluded.tagline,
        description = excluded.description,
        phone = excluded.phone,
        whatsapp = excluded.whatsapp,
        delivery_info = excluded.delivery_info,
        logo_url = excluded.logo_url,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      settings.shop_name,
      settings.tagline,
      settings.description,
      settings.phone,
      settings.whatsapp,
      settings.delivery_info,
      settings.logo_url,
    ).run();

    return Response.json({ success: true, settings });
  } catch {
    return Response.json(
      { error: "Could not save shop settings." },
      { status: 500 },
    );
  }
}
