import { z } from "zod";

const textPartSchema = z.object({
  text: z.string().min(1).max(32000),
  type: z.enum(["text"]),
});

const filePartSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  type: z.enum(["file"]),
  url: z.url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.uuid(),
  parts: z.array(partSchema),
  role: z.enum(["user"]),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())),
  role: z.enum(["user", "assistant"]),
});

export const postRequestBodySchema = z.object({
  id: z.uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  temperature: z.number().min(0).max(2).optional(),
  customInstructions: z.string().max(8000).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
