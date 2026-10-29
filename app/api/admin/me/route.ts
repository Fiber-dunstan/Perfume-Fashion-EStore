import { getAdmin } from "@/src/lib/admin-session";

export async function GET(request: Request) {
  const administrator = await getAdmin(request);

  if (!administrator) {
    return Response.json(
      { error: "Authentication required." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(
    { administrator },
    { headers: { "Cache-Control": "no-store" } },
  );
}
