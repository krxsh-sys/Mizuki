import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";
import { resolveFallbackChain } from "./router";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const chain = resolveFallbackChain(modelId);
  if (chain.length === 0) {
    throw new Error("No API keys configured (GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY).");
  }
  return chain[0].model;
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return getLanguageModel(titleModel.id);
}
