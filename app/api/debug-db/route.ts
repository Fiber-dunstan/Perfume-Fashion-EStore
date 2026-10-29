import { env } from "cloudflare:workers";

export async function GET() {
  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all();

    return Response.json({
      databaseBindingAvailable: Boolean(env.DB),
      tables: result.results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
