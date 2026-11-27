"use client";

import { PanelLeftIcon, PenSquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback } from "react";
import { MizukiSettingsDrawer } from "@/components/mizuki-settings-drawer";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const showCollapsedControls = state === "collapsed" || isMobile;

  const handleNewChat = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 bg-background/85 px-3 backdrop-blur-md">
      {showCollapsedControls && (
        <div className="flex items-center gap-1">
          <Button
            aria-label="Toggle sidebar"
            className="size-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={toggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            <PanelLeftIcon className="size-4" />
          </Button>

          <Button
            aria-label="New chat"
            className="size-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={handleNewChat}
            size="icon-sm"
            variant="ghost"
          >
            <PenSquareIcon className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="select-none text-[15px] font-semibold tracking-tight text-foreground">
          Mizuki
        </span>
        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MizukiSettingsDrawer />
      </div>
    </header>
  );
}

export const ChatHeader = memo(
  PureChatHeader,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
);
