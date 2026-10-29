
import { env } from "cloudflare:workers";
import { getAdmin } from "@/src/lib/admin-session";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signParameters(
  params: Record<string, string>,
  secret: string,
): Promise<string> {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const digest = await crypto.subtle.digest(
    "SHA-1",
    encoder.encode(canonical + secret),
  );

  return toHex(new Uint8Array(digest));
}

export async function POST(request: Request) {
  if (!(await getAdmin(request))) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const bindings = env as typeof env & {
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
  };

  const cloudName = bindings.CLOUDINARY_CLOUD_NAME;
  const apiKey = bindings.CLOUDINARY_API_KEY;
  const apiSecret = bindings.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json(
      { error: "Cloudinary server configuration is missing." },
      { status: 500 },
    );
  }

  let requestedFolder = "products";

  try {
    const body = await request.json() as { purpose?: unknown };
    if (body.purpose === "logo") requestedFolder = "logos";
  } catch {
    // Existing product uploader sends no request body.
  }

  const folder =
    requestedFolder === "logos"
      ? "perfume-fashion-store/logos"
      : "perfume-fashion-store/products";

  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const signature = await signParameters({ folder, timestamp }, apiSecret);

    return Response.json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
    });
  } catch (error) {
    console.error("Could not sign Cloudinary upload:", error);
    return Response.json(
      { error: "Could not authorize the image upload." },
      { status: 500 },
    );
  }
}
