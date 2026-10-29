import {
  deleteAdminSession,
  expiredSessionCookie,
} from "@/src/lib/admin-session";

export async function POST(request: Request) {
  await deleteAdminSession(request);

  return Response.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": expiredSessionCookie(),
        "Cache-Control": "no-store",
      },
    },
  );
}
