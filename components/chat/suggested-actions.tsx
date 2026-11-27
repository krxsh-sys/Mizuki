"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  Code2Icon,
  LightbulbIcon,
  SparklesIcon,
  TerminalIcon,
} from "lucide-react";
import { memo, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

const QUICK_CHIPS = [
  {
    icon: TerminalIcon,
    label: "Write code",
    prompt: "Help me write clean, production-ready code for ",
  },
  {
    icon: Code2Icon,
    label: "Debug issue",
    prompt: "Help me debug an error step by step. Here is what is happening: ",
  },
  {
    icon: LightbulbIcon,
    label: "Brainstorm",
    prompt: "Brainstorm 5 sharp, original ideas for ",
  },
  {
    icon: SparklesIcon,
    label: "Explain fast",
    prompt: "Explain this clearly with zero fluff and a concrete example: ",
  },
];

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const handleChipClick = useCallback(
    (prompt: string) => {
      window.history.pushState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        parts: [{ text: prompt.trim(), type: "text" }],
        role: "user",
      });
    },
    [chatId, sendMessage]
  );

  return (
    <div
      className="no-scrollbar flex w-full items-center justify-start gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center"
      data-testid="suggested-actions"
    >
      {QUICK_CHIPS.map((chip, index) => {
        const Icon = chip.icon;
        return (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-secondary/45 px-3.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-secondary hover:text-foreground active:scale-95"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 10 }}
            key={chip.label}
            onClick={() => handleChipClick(chip.prompt)}
            transition={{
              delay: 0.04 * index,
              duration: 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            type="button"
          >
            <Icon className="size-3.5 opacity-80" />
            <span>{chip.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType
);
