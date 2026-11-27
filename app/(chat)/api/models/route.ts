import { getAllGatewayModels } from "@/lib/ai/models";

export async function GET() {
  const headers = {
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  };

  const models = await getAllGatewayModels();
  const capabilities = Object.fromEntries(
    models.map((m) => [m.id, m.capabilities])
  );

  return Response.json({ capabilities, models }, { headers });
}
