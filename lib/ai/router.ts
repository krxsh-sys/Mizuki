import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export type ProviderName = "gemini" | "groq" | "openrouter";

export type RouteCandidate = {
  provider: ProviderName;
  rawModelId: string;
  fullId: string;
  model: LanguageModel;
};

// In-memory sticky circuit breaker (prevents frequent thrashing)
const healthMap = new Map<string, { failures: number; cooldownUntil: number }>();

const GEMINI_CASCADE = [
  "gemini-3.8-flash",
  "gemini-4-hydrogen",
  "gemini-3.5-flash-lite",
];

const GROQ_CASCADE = ["qwen/qwen3.8-27b"];

const OPENROUTER_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "openrouter/auto",
];

function getKeys() {
  return {
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
    groq: process.env.GROQ_API_KEY || "",
    openrouter: process.env.OPENROUTER_API_KEY || "",
  };
}

export function isRouteHealthy(key: string): boolean {
  const entry = healthMap.get(key);
  if (!entry) return true;
  if (Date.now() > entry.cooldownUntil) {
    healthMap.delete(key);
    return true;
  }
  return false;
}

export function recordRouteSuccess(provider: ProviderName, rawModelId: string) {
  healthMap.delete(`${provider}:${rawModelId}`);
  healthMap.delete(`key:${provider}`);
}

export function recordRouteFailure(
  provider: ProviderName,
  rawModelId: string,
  error: unknown
) {
  const msg = String(error ?? "").toLowerCase();
  const isQuotaOrAuth =
    msg.includes("quota") ||
    msg.includes("401") ||
    msg.includes("402") ||
    msg.includes("403") ||
    msg.includes("exhausted") ||
    msg.includes("insufficient");

  const cooldownMs = isQuotaOrAuth ? 5 * 60 * 1000 : 60 * 1000;
  const routeKey = `${provider}:${rawModelId}`;
  const prev = healthMap.get(routeKey)?.failures ?? 0;

  healthMap.set(routeKey, {
    failures: prev + 1,
    cooldownUntil: Date.now() + cooldownMs,
  });

  // If the entire key is exhausted/invalid, cool down the whole provider key
  if (isQuotaOrAuth) {
    healthMap.set(`key:${provider}`, {
      failures: prev + 1,
      cooldownUntil: Date.now() + cooldownMs,
    });
  }
}

function buildModelInstance(provider: ProviderName, rawModelId: string): LanguageModel | null {
  const keys = getKeys();

  if (provider === "gemini" && keys.gemini) {
    const google = createGoogleGenerativeAI({ apiKey: keys.gemini });
    return google(rawModelId) as unknown as LanguageModel;
  }
  if (provider === "groq" && keys.groq) {
    const groq = createGroq({ apiKey: keys.groq });
    return groq(rawModelId) as unknown as LanguageModel;
  }
  if (provider === "openrouter" && keys.openrouter) {
    const openrouter = createOpenRouter({ apiKey: keys.openrouter });
    return openrouter(rawModelId) as unknown as LanguageModel;
  }
  return null;
}

function pushCandidate(
  list: RouteCandidate[],
  seen: Set<string>,
  provider: ProviderName,
  rawModelId: string
) {
  const key = `${provider}:${rawModelId}`;
  if (seen.has(key)) return;
  if (!isRouteHealthy(`key:${provider}`) || !isRouteHealthy(key)) return;

  const model = buildModelInstance(provider, rawModelId);
  if (!model) return;

  seen.add(key);
  list.push({
    provider,
    rawModelId,
    fullId: `${provider}/${rawModelId}`,
    model,
  });
}

/**
 * Builds an ordered fallback chain:
 * 1. Exact requested model on its native/direct key (sticky first choice)
 * 2. Same-provider cascade (e.g., Gemini Flash -> Hydrogen -> Flash-Lite)
 * 3. Cross-provider fallback (Groq -> OpenRouter)
 */
export function resolveFallbackChain(requestedId: string): RouteCandidate[] {
  const candidates: RouteCandidate[] = [];
  const seen = new Set<string>();
  const keys = getKeys();

  // 1. Detect direct provider ownership & try exact model first
  if (requestedId.startsWith("google/") || requestedId.startsWith("gemini/")) {
    const raw = requestedId.replace(/^(google|gemini)\//, "");
    if (keys.gemini) {
      pushCandidate(candidates, seen, "gemini", raw);
      for (const fallback of GEMINI_CASCADE) {
        pushCandidate(candidates, seen, "gemini", fallback);
      }
    }
    if (keys.openrouter) {
      pushCandidate(candidates, seen, "openrouter", `google/${raw}`);
    }
  } else if (requestedId.startsWith("groq/")) {
    const raw = requestedId.slice("groq/".length);
    if (keys.groq) {
      pushCandidate(candidates, seen, "groq", raw);
      for (const fallback of GROQ_CASCADE) {
        pushCandidate(candidates, seen, "groq", fallback);
      }
    }
  } else {
    // OpenRouter 300+ model ID (e.g. "meta-llama/llama-3.3-70b-instruct:free")
    const raw = requestedId.replace(/^openrouter\//, "");

    // Auto-detect if a Gemini or Groq model was selected from the 300+ list
    if (raw.startsWith("google/gemini") && keys.gemini) {
      pushCandidate(candidates, seen, "gemini", raw.replace("google/", ""));
    }
    if (keys.openrouter) {
      pushCandidate(candidates, seen, "openrouter", raw);
    }
  }

  // 2. Cross-provider safety net (only used if primary key fails)
  if (keys.gemini) {
    for (const m of GEMINI_CASCADE) pushCandidate(candidates, seen, "gemini", m);
  }
  if (keys.groq) {
    for (const m of GROQ_CASCADE) pushCandidate(candidates, seen, "groq", m);
  }
  if (keys.openrouter) {
    for (const m of OPENROUTER_FALLBACKS) {
      pushCandidate(candidates, seen, "openrouter", m);
    }
  }

  // 3. Emergency reset if everything is in cooldown
  if (candidates.length === 0) {
    healthMap.clear();
    if (keys.gemini) {
      const m = buildModelInstance("gemini", GEMINI_CASCADE[0]);
      if (m) candidates.push({ provider: "gemini", rawModelId: GEMINI_CASCADE[0], fullId: `google/${GEMINI_CASCADE[0]}`, model: m });
    } else if (keys.groq) {
      const m = buildModelInstance("groq", GROQ_CASCADE[0]);
      if (m) candidates.push({ provider: "groq", rawModelId: GROQ_CASCADE[0], fullId: `groq/${GROQ_CASCADE[0]}`, model: m });
    } else if (keys.openrouter) {
      const m = buildModelInstance("openrouter", OPENROUTER_FALLBACKS[0]);
      if (m) candidates.push({ provider: "openrouter", rawModelId: OPENROUTER_FALLBACKS[0], fullId: OPENROUTER_FALLBACKS[0], model: m });
    }
  }

  return candidates;
}
