export const DEFAULT_CHAT_MODEL = "google/gemini-3.8-flash";

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
  id: "google/gemini-3.5-flash-lite",
  name: "Gemini 3.5 Flash-Lite",
  provider: "google",
  description: "Ultra-fast lightweight model for chat titles",
};

// Pinned direct models (always at top of selector)
export const chatModels: ChatModel[] = [
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    description: "Direct Gemini key — fast multimodal reasoning (auto-fallback enabled)",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    provider: "google",
    description: "Direct Gemini key — crisp coding & everyday chat",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "google",
    description: "Direct Gemini key — high-speed fallback tier",
    capabilities: { tools: true, vision: true, reasoning: false },
  },
  {
    id: "groq/qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B (Groq)",
    provider: "groq",
    description: "Direct Groq key — instant speed coding & chat",
    capabilities: { tools: true, vision: false, reasoning: true },
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    provider: "meta-llama",
    description: "OpenRouter — 70B open-weight flagship",
    capabilities: { tools: true, vision: false, reasoning: false },
  },
  {
    id: "openrouter/auto",
    name: "OpenRouter Auto",
    provider: "openrouter",
    description: "Auto-routes across 300+ models on OpenRouter",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
];

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
};

// Dynamically pulls 300+ live models from OpenRouter + merges with direct keys
export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  const base: GatewayModelWithCapabilities[] = chatModels.map((m) => ({
    ...m,
    capabilities: m.capabilities ?? { tools: true, vision: false, reasoning: false },
  }));

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return base;

    const json = await res.json();
    const seen = new Set(base.map((m) => m.id));
    const dynamicModels: GatewayModelWithCapabilities[] = (
      (json.data ?? []) as OpenRouterModel[]
    )
      .filter((m) => m.id && !seen.has(m.id))
      .map((m) => {
        const params = new Set(m.supported_parameters ?? []);
        const modalities = new Set(m.architecture?.input_modalities ?? []);
        return {
          id: m.id,
          name: m.name || m.id,
          provider: m.id.split("/")[0] || "openrouter",
          description: m.description?.slice(0, 120) || "",
          capabilities: {
            tools: params.has("tools"),
            vision: modalities.has("image"),
            reasoning: params.has("reasoning") || params.has("include_reasoning"),
          },
        };
      });

    return [...base, ...dynamicModels];
  } catch {
    return base;
  }
}

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const all = await getAllGatewayModels();
  return Object.fromEntries(all.map((m) => [m.id, m.capabilities]));
}

export const isDemo = process.env.IS_DEMO === "1";

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
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
