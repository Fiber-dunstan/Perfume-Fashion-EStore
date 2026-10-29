import { env } from "cloudflare:workers";
import { verifyPassword } from "@/src/lib/password";
import {
  createAdminSession,
  sessionCookie,
} from "@/src/lib/admin-session";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 1024
  ) {
    return Response.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  const administrator = await env.DB.prepare(`
    SELECT id, email, password_hash
    FROM administrators
    WHERE email = ? COLLATE NOCASE AND is_active = 1
    LIMIT 1
  `).bind(email).first<{
    id: string;
    email: string;
    password_hash: string;
  }>();

  if (
    !administrator ||
    !(await verifyPassword(password, administrator.password_hash))
  ) {
    return Response.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const session = await createAdminSession(administrator.id);

  return Response.json(
    {
      administrator: {
        id: administrator.id,
        email: administrator.email,
      },
    },
    {
      headers: {
        "Set-Cookie": sessionCookie(session.token),
        "Cache-Control": "no-store",
      },
    },
  );
}
