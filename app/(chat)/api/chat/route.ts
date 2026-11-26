import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { generateTitleFromUserMessage } from "@/lib/ai/generate-title";
import {
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  getModelAvailability,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  recordRouteFailure,
  recordRouteSuccess,
  resolveFallbackChain,
} from "@/lib/ai/router";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { logTrainingExample } from "@/lib/ai/training-logger";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage, WaitingStatusData } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const HEALTH_CHECK_DELAY_MS = 9000;

function isModelStreamActivity(chunk: { type: string }) {
  return !["start", "start-step", "finish-step", "finish", "raw"].includes(
    chunk.type
  );
}

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: string; text?: string } =>
        typeof p === "object" && p !== null && (p as { type?: string }).type === "text"
    )
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType, temperature, customInstructions } =
      requestBody;

    const [botIdResult, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (botIdResult?.isBot) {
      return new ChatbotError("forbidden:api").toResponse();
    }

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // Allow any of the 300+ dynamic models instead of restricting to hardcoded IDs
    const chatModel = selectedChatModel?.trim() || DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      differenceInHours: 1,
      id: session.user.id,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        title: "New chat",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      city,
      country,
      latitude,
      longitude,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            attachments: [],
            chatId: id,
            createdAt: new Date(),
            id: message.id,
            parts: message.parts,
            role: "user",
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools !== false;

    const modelMessages = await convertToModelMessages(uiMessages);
    const baseSystemPrompt = systemPrompt({ requestHints, supportsTools });
    const activeSystemPrompt = customInstructions?.trim()
      ? `${baseSystemPrompt}\n\n## User Custom Instructions\n${customInstructions.trim()}`
      : baseSystemPrompt;

    let servedModel = chatModel;
    let servedProvider = "unknown";

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelName = modelConfig?.name ?? chatModel;

        let hasModelActivity = false;
        let healthCheckTimer: ReturnType<typeof setTimeout> | undefined;

        const clearHealthCheckTimer = () => {
          if (healthCheckTimer) {
            clearTimeout(healthCheckTimer);
          }
        };

        const writeWaitingStatus = (
          phase: WaitingStatusData["phase"],
          messageText: string
        ) => {
          if (hasModelActivity && phase !== "thinking") {
            return;
          }
          dataStream.write({
            data: {
              message: messageText,
              modelId: chatModel,
              modelName,
              phase,
            },
            transient: true,
            type: "data-waiting-status",
          });
        };

        writeWaitingStatus("waiting", "Waiting...");

        healthCheckTimer = setTimeout(() => {
          getModelAvailability(chatModel)
            .then((availability) => {
              if (availability === "impacted") {
                writeWaitingStatus(
                  "health",
                  `${modelName} may be slow or unavailable right now...`
                );
              } else {
                writeWaitingStatus("still-waiting", "Still waiting...");
              }
            })
            .catch(() => {
              writeWaitingStatus("still-waiting", "Still waiting...");
            });
        }, HEALTH_CHECK_DELAY_MS);

        const markModelActive = () => {
          if (hasModelActivity) {
            return;
          }
          hasModelActivity = true;
          clearHealthCheckTimer();
          writeWaitingStatus("thinking", "Thinking...");
        };

        const stopWaitingStatus = () => {
          hasModelActivity = true;
          clearHealthCheckTimer();
        };

        // Intelligent sticky circuit-breaker fallback loop
        const chain = resolveFallbackChain(chatModel);
        let merged = false;
        let lastError: unknown = null;

        for (let i = 0; i < chain.length; i++) {
          const candidate = chain[i];

          if (i > 0) {
            writeWaitingStatus(
              "still-waiting",
              `Routing to ${candidate.rawModelId}...`
            );
          }

          try {
            const result = streamText({
              activeTools:
                isReasoningModel && !supportsTools
                  ? []
                  : [
                      "getWeather",
                      "createDocument",
                      "editDocument",
                      "updateDocument",
                      "requestSuggestions",
                    ],
              instructions: activeSystemPrompt,
              ...(typeof temperature === "number" ? { temperature } : {}),
              messages: modelMessages,
              model: candidate.model,
              onAbort() {
                stopWaitingStatus();
              },
              onChunk({ chunk }) {
                if (isModelStreamActivity(chunk)) {
                  markModelActive();
                }
              },
              onEnd() {
                stopWaitingStatus();
              },
              onError() {
                stopWaitingStatus();
              },
              stopWhen: isStepCount(5),
              telemetry: {
                functionId: "stream-text",
                isEnabled: isProductionEnvironment,
              },
              tools: {
                createDocument: createDocument({
                  dataStream,
                  modelId: candidate.fullId,
                  session,
                }),
                editDocument: editDocument({ dataStream, session }),
                getWeather,
                requestSuggestions: requestSuggestions({
                  dataStream,
                  modelId: candidate.fullId,
                  session,
                }),
                updateDocument: updateDocument({
                  dataStream,
                  modelId: candidate.fullId,
                  session,
                }),
              },
            });

            // Peek stream until first real activity or immediate provider error
            const reader = result.stream.getReader();
            const buffered: NonNullable<Awaited<ReturnType<typeof reader.read>>["value"]>[] = [];
            let failed = false;

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const chunk = value as { type?: string; error?: unknown };
              if (chunk?.type === "error") {
                lastError = chunk.error ?? new Error("Provider stream error");
                failed = true;
                break;
              }
              buffered.push(value);
              if (chunk?.type && isModelStreamActivity({ type: chunk.type })) {
                break;
              }
            }

            if (failed || buffered.length === 0) {
              await reader.cancel().catch(() => {});
              recordRouteFailure(
                candidate.provider,
                candidate.rawModelId,
                lastError
              );
              continue;
            }

            servedModel = candidate.fullId;
            servedProvider = candidate.provider;
            recordRouteSuccess(candidate.provider, candidate.rawModelId);

            const replayStream = new ReadableStream({
              async start(controller) {
                for (const item of buffered) {
                  controller.enqueue(item);
                }
                try {
                  while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                  }
                  controller.close();
                } catch (err) {
                  controller.error(err);
                }
              },
              cancel() {
                reader.cancel().catch(() => {});
              },
            }) as typeof result.stream;

            dataStream.merge(
              toUIMessageStream({
                sendReasoning: isReasoningModel,
                stream: replayStream,
              })
            );
            merged = true;
            break;
          } catch (err) {
            lastError = err;
            recordRouteFailure(candidate.provider, candidate.rawModelId, err);
          }
        }

        if (!merged) {
          stopWaitingStatus();
          throw lastError ?? new Error("All configured AI providers failed.");
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ data: title, type: "data-chat-title" });
            updateChatTitleById({ chatId: id, title });
          } catch {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onEnd: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          await Promise.all(
            finishedMessages.map(async (finishedMsg) => {
              const existingMsg = uiMessages.find(
                (m) => m.id === finishedMsg.id
              );
              if (existingMsg) {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
                return;
              }

              await saveMessages({
                messages: [
                  {
                    attachments: [],
                    chatId: id,
                    createdAt: new Date(),
                    id: finishedMsg.id,
                    parts: finishedMsg.parts,
                    role: finishedMsg.role,
                  },
                ],
              });
            })
          );
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              attachments: [],
              chatId: id,
              createdAt: new Date(),
              id: currentMessage.id,
              parts: currentMessage.parts,
              role: currentMessage.role,
            })),
          });
        }

        // Capture clean (prompt -> completion) training data in Supabase
        const lastUserText = extractTextFromParts(message?.parts);
        const assistantText = finishedMessages
          .filter((m) => m.role === "assistant")
          .map((m) => extractTextFromParts(m.parts))
          .join("\n")
          .trim();

        if (lastUserText && assistantText) {
          await logTrainingExample({
            chatId: id,
            userId: session.user.id,
            requestedModel: chatModel,
            servedModel,
            provider: servedProvider,
            systemPrompt: activeSystemPrompt,
            prompt: lastUserText,
            completion: assistantText,
          });
        }
      },
      onError: (error) => {
        console.error("[chat stream error]:", error);
        return "Oops, an error occurred while generating a response!";
      },
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch {
          /* non-critical */
        }
      },
      stream,
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
