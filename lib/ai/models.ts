export const DEFAULT_CHAT_MODEL = "groq/openai/gpt-oss-20b";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "low" | "medium" | "high";
  capabilities?: ModelCapabilities;
};

export const titleModel: ChatModel = {
  description: "Ultra-fast model for title generation",
  id: "groq/openai/gpt-oss-20b",
  name: "GPT OSS 20B",
  provider: "groq",
};

export const chatModels: ChatModel[] = [
  {
    id: "groq/openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "groq",
    description: "Insanely fast 1000 tps reasoning & chat on Groq",
    reasoningEffort: "low",
    capabilities: { tools: true, vision: false, reasoning: true },
  },
  {
    id: "groq/openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "groq",
    description: "Flagship open-weight 120B reasoning model on Groq",
    reasoningEffort: "low",
    capabilities: { tools: true, vision: false, reasoning: true },
  },
  {
    id: "groq/qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    provider: "groq",
    description: "Sharp coding & general chat model on Groq",
    capabilities: { tools: true, vision: false, reasoning: true },
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    description: "Fast multimodal reasoning with vision & long context",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "google",
    description: "Lightweight, high-speed Gemini for everyday chat",
    capabilities: { tools: true, vision: true, reasoning: false },
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return Object.fromEntries(
    chatModels.map((m) => [
      m.id,
      m.capabilities ?? { tools: true, vision: false, reasoning: false },
    ])
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  return chatModels.map((m) => ({
    ...m,
    capabilities: m.capabilities ?? {
      tools: true,
      vision: false,
      reasoning: false,
    },
  }));
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

export type ModelAvailability = "healthy" | "impacted" | "unknown";

export async function getModelAvailability(
  _modelId: string
): Promise<ModelAvailability> {
  return "healthy";
}
