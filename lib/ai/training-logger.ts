import postgres from "postgres";

const sql = process.env.POSTGRES_URL
  ? postgres(process.env.POSTGRES_URL, { max: 1 })
  : null;

export async function logTrainingExample(data: {
  chatId: string;
  userId?: string;
  requestedModel: string;
  servedModel: string;
  provider: string;
  systemPrompt: string;
  prompt: string;
  completion: string;
}) {
  if (!sql || !data.prompt.trim() || !data.completion.trim()) return;

  try {
    await sql`
      insert into training_logs (
        chat_id,
        user_id,
        requested_model,
        served_model,
        provider,
        system_prompt,
        prompt,
        completion
      ) values (
        ${data.chatId},
        ${data.userId ?? null},
        ${data.requestedModel},
        ${data.servedModel},
        ${data.provider},
        ${data.systemPrompt},
        ${data.prompt},
        ${data.completion}
      )
    `;
  } catch (err) {
    console.error("[training-logger] non-fatal insert error:", err);
  }
}
