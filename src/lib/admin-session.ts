import { env } from "cloudflare:workers";

const SESSION_COOKIE = "store_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function digestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toBase64Url(new Uint8Array(digest));
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function expiredSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function createAdminSession(
  administratorId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1000,
  ).toISOString();

  await env.DB.prepare(`
    INSERT INTO sessions (id_hash, administrator_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(await digestToken(token), administratorId, expiresAt).run();

  return { token, expiresAt };
}

export async function getAdmin(
  request: Request,
): Promise<{ id: string; email: string } | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const sessionHash = await digestToken(token);
  const now = new Date().toISOString();

  return env.DB.prepare(`
    SELECT a.id, a.email
    FROM sessions s
    JOIN administrators a ON a.id = s.administrator_id
    WHERE s.id_hash = ?
      AND s.expires_at > ?
      AND a.is_active = 1
    LIMIT 1
  `).bind(sessionHash, now).first<{ id: string; email: string }>();
}

export async function deleteAdminSession(request: Request): Promise<void> {
  const token = getSessionToken(request);
  if (!token) return;

  await env.DB.prepare(`
    DELETE FROM sessions WHERE id_hash = ?
  `).bind(await digestToken(token)).run();
}
