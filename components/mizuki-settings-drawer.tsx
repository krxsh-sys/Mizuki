"use client";

import {
  CheckIcon,
  CopyIcon,
  DatabaseIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PlusIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyMizukiAppearance,
  DEFAULT_MIZUKI_CONFIG,
  getActiveProfile,
  loadMizukiConfig,
  MIZUKI_CONFIG_EVENT,
  MIZUKI_OPEN_SETTINGS_EVENT,
  type MizukiConfig,
  type MizukiFontSize,
  type MizukiProfile,
  saveMizukiConfig,
} from "@/lib/mizuki-config";

type TabId = "tuning" | "personalization" | "appearance" | "data";

const TEMP_PRESETS = [
  { label: "Precise", desc: "Code & facts", value: 0.2 },
  { label: "Balanced", desc: "Everyday", value: 0.7 },
  { label: "Creative", desc: "Expressive", value: 1.15 },
  { label: "Wild", desc: "Max variety", value: 1.5 },
];

const QUICK_VIBES = [
  {
    label: "Ultra Concise",
    text: "Keep answers crisp and under 5 lines unless asked for depth.",
  },
  {
    label: "Senior Engineer",
    text: "Skip beginner explanations. Give production code, edge cases, and exact commands.",
  },
  {
    label: "Casual Hinglish",
    text: "Talk naturally in casual English with occasional light Hinglish energy.",
  },
  {
    label: "No Fluff",
    text: "Never open with filler phrases or apologies. Start directly with the answer.",
  },
];

export function MizukiSettingsDrawer() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("tuning");
  const [config, setConfig] = useState<MizukiConfig>(DEFAULT_MIZUKI_CONFIG);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = loadMizukiConfig();
    setConfig(loaded);
    applyMizukiAppearance(loaded);

    const sync = () => {
      const next = loadMizukiConfig();
      setConfig(next);
      applyMizukiAppearance(next);
    };

    const handleOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: TabId }>).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
      }
      setOpen(true);
    };

    window.addEventListener(MIZUKI_CONFIG_EVENT, sync);
    window.addEventListener(MIZUKI_OPEN_SETTINGS_EVENT, handleOpenEvent);
    return () => {
      window.removeEventListener(MIZUKI_CONFIG_EVENT, sync);
      window.removeEventListener(MIZUKI_OPEN_SETTINGS_EVENT, handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeProfile = getActiveProfile(config);

  const commit = (next: MizukiConfig) => {
    setConfig(next);
    saveMizukiConfig(next);
  };

  const updateActiveProfile = (patch: Partial<MizukiProfile>) => {
    commit({
      ...config,
      profiles: config.profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, ...patch } : p
      ),
    });
  };

  const stepTemperature = (delta: number) => {
    const next = Math.min(
      2,
      Math.max(0, Number((activeProfile.temperature + delta).toFixed(2)))
    );
    updateActiveProfile({ temperature: next });
  };

  const handleCreateProfile = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `profile-${Date.now()}`;
    const created: MizukiProfile = {
      id,
      name: trimmed,
      temperature: 0.7,
      instructions: "",
      builtIn: false,
    };
    commit({
      ...config,
      activeProfileId: id,
      profiles: [...config.profiles, created],
    });
    setNewName("");
    setCreating(false);
  };

  const handleDeleteProfile = (id: string) => {
    const remaining = config.profiles.filter((p) => p.id !== id);
    if (remaining.length === 0) return;
    commit({
      ...config,
      activeProfileId:
        config.activeProfileId === id ? remaining[0].id : config.activeProfileId,
      profiles: remaining,
    });
  };

  const appendVibe = (text: string) => {
    const current = config.globalInstructions.trim();
    if (current.includes(text)) return;
    commit({
      ...config,
      globalInstructions: current ? `${current}
${text}` : text,
    });
  };

  const handleExportConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const openWithTab = (tab: TabId) => {
    setActiveTab(tab);
    setOpen(true);
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "tuning",
      label: "Model & Tuning",
      icon: <SlidersHorizontalIcon className="size-3.5" />,
    },
    {
      id: "personalization",
      label: "Personalization",
      icon: <SparklesIcon className="size-3.5" />,
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: <PaletteIcon className="size-3.5" />,
    },
    {
      id: "data",
      label: "Data & Router",
      icon: <DatabaseIcon className="size-3.5" />,
    },
  ];

  const modal = (
    <div
      aria-label="Mizuki Settings"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
    >
      <div
        className="mizuki-fade-in fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="mizuki-sheet-up relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#171717] text-zinc-100 shadow-2xl sm:h-[620px] sm:max-w-2xl sm:rounded-2xl">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-bold tracking-tight text-black">
              M
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-white">
                Settings
              </h2>
              <p className="text-[11px] text-zinc-400">
                {activeProfile.name} · Temp {activeProfile.temperature.toFixed(2)}
              </p>
            </div>
          </div>

          <button
            aria-label="Close settings"
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white active:scale-95"
            onClick={() => setOpen(false)}
            type="button"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Navigation Tabs */}
          <nav className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/[0.08] px-4 py-2.5 sm:w-52 sm:flex-col sm:border-r sm:border-b-0 sm:p-3">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition active:scale-[0.98] ${
                    selected
                      ? "bg-white/[0.12] text-white"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {activeTab === "tuning" && (
              <div className="space-y-6">
                {/* Profiles */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">
                      Active Profile
                    </span>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                      onClick={() => setCreating((v) => !v)}
                      type="button"
                    >
                      <PlusIcon className="size-3" />
                      {creating ? "Cancel" : "New profile"}
                    </button>
                  </div>

                  {creating && (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-xl border border-white/10 bg-[#212121] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateProfile();
                        }}
                        placeholder="e.g. Exam Prep, Roleplay, Debug"
                        type="text"
                        value={newName}
                      />
                      <button
                        className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
                        onClick={handleCreateProfile}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {config.profiles.map((profile) => {
                      const isActive = profile.id === activeProfile.id;
                      return (
                        <div
                          className={`inline-flex items-center rounded-full border text-xs transition ${
                            isActive
                              ? "border-white bg-white font-semibold text-black"
                              : "border-white/10 bg-[#212121] text-zinc-300 hover:border-white/25"
                          }`}
                          key={profile.id}
                        >
                          <button
                            className="px-3.5 py-1.5"
                            onClick={() =>
                              commit({ ...config, activeProfileId: profile.id })
                            }
                            type="button"
                          >
                            {profile.name}
                          </button>
                          {!profile.builtIn && (
                            <button
                              aria-label={`Delete ${profile.name}`}
                              className={`pr-2.5 text-sm leading-none opacity-60 hover:opacity-100 ${
                                isActive ? "text-black" : "text-zinc-400"
                              }`}
                              onClick={() => handleDeleteProfile(profile.id)}
                              type="button"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Temperature Card */}
                <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Temperature
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Lower = focused · Higher = creative
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        aria-label="Decrease temperature"
                        className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#171717] text-base text-zinc-200 transition hover:bg-white/10 active:scale-90"
                        onClick={() => stepTemperature(-0.1)}
                        type="button"
                      >
                        −
                      </button>
                      <span className="min-w-[48px] text-center font-mono text-sm font-semibold text-white">
                        {activeProfile.temperature.toFixed(2)}
                      </span>
                      <button
                        aria-label="Increase temperature"
                        className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#171717] text-base text-zinc-200 transition hover:bg-white/10 active:scale-90"
                        onClick={() => stepTemperature(0.1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <input
                    className="mizuki-slider w-full cursor-pointer touch-none"
                    max={2}
                    min={0}
                    onChange={(e) =>
                      updateActiveProfile({
                        temperature: Number.parseFloat(e.target.value),
                      })
                    }
                    step={0.05}
                    type="range"
                    value={activeProfile.temperature}
                  />

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TEMP_PRESETS.map((preset) => {
                      const active =
                        Math.abs(activeProfile.temperature - preset.value) < 0.06;
                      return (
                        <button
                          className={`rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.97] ${
                            active
                              ? "border-white/40 bg-white/[0.12] text-white"
                              : "border-white/[0.06] bg-[#171717] text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                          }`}
                          key={preset.label}
                          onClick={() =>
                            updateActiveProfile({ temperature: preset.value })
                          }
                          type="button"
                        >
                          <div className="text-xs font-medium">
                            {preset.label}
                          </div>
                          <div className="text-[10px] opacity-65">
                            {preset.value.toFixed(2)} · {preset.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "personalization" && (
              <div className="space-y-5">
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-medium text-zinc-200"
                      htmlFor="mizuki-profile-inst"
                    >
                      Profile Prompt ({activeProfile.name})
                    </label>
                    <span className="text-[11px] text-zinc-500">
                      Active profile only
                    </span>
                  </div>
                  <textarea
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#212121] p-3.5 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                    id="mizuki-profile-inst"
                    onChange={(e) =>
                      updateActiveProfile({ instructions: e.target.value })
                    }
                    placeholder="Define how Mizuki thinks, formats code, or adjusts tone in this profile..."
                    rows={4}
                    value={activeProfile.instructions}
                  />
                </section>

                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-medium text-zinc-200"
                      htmlFor="mizuki-global-inst"
                    >
                      Custom Instructions (All Chats)
                    </label>
                    <span className="text-[11px] text-zinc-500">
                      Global memory layer
                    </span>
                  </div>
                  <textarea
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#212121] p-3.5 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
                    id="mizuki-global-inst"
                    onChange={(e) =>
                      commit({ ...config, globalInstructions: e.target.value })
                    }
                    placeholder="What should Mizuki always remember about you across every chat?"
                    rows={4}
                    value={config.globalInstructions}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QUICK_VIBES.map((vibe) => (
                      <button
                        className="rounded-full border border-white/10 bg-[#212121] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-white/25 hover:text-white active:scale-95"
                        key={vibe.label}
                        onClick={() => appendVibe(vibe.text)}
                        type="button"
                      >
                        + {vibe.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-4">
                <section className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                  <div className="text-sm font-medium text-white">Theme</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "dark",
                        label: "Dark",
                        icon: <MoonIcon className="size-3.5" />,
                      },
                      {
                        id: "light",
                        label: "Light",
                        icon: <SunIcon className="size-3.5" />,
                      },
                      {
                        id: "system",
                        label: "System",
                        icon: <MonitorIcon className="size-3.5" />,
                      },
                    ].map((opt) => {
                      const active = theme === opt.id;
                      return (
                        <button
                          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition ${
                            active
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-[#171717] text-zinc-300 hover:border-white/25"
                          }`}
                          key={opt.id}
                          onClick={() => setTheme(opt.id)}
                          type="button"
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Pitch-Black OLED Surface
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Switch dark mode from Charcoal (#212121) to Pure Black (#000000)
                    </div>
                  </div>
                  <button
                    aria-checked={Boolean(config.oledMode)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      config.oledMode ? "bg-white" : "bg-zinc-700"
                    }`}
                    onClick={() =>
                      commit({ ...config, oledMode: !config.oledMode })
                    }
                    role="switch"
                    type="button"
                  >
                    <span
                      className={`block size-5 rounded-full transition-transform ${
                        config.oledMode
                          ? "translate-x-[22px] bg-black"
                          : "translate-x-[2px] bg-zinc-200"
                      }`}
                    />
                  </button>
                </section>

                <section className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                  <div className="text-sm font-medium text-white">
                    Reading Text Scale
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "sm", label: "Compact" },
                        { id: "md", label: "Default" },
                        { id: "lg", label: "Comfortable" },
                      ] as { id: MizukiFontSize; label: string }[]
                    ).map((opt) => {
                      const active = (config.fontSize ?? "md") === opt.id;
                      return (
                        <button
                          className={`rounded-xl border py-2 text-xs font-medium transition ${
                            active
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-[#171717] text-zinc-300 hover:border-white/25"
                          }`}
                          key={opt.id}
                          onClick={() =>
                            commit({ ...config, fontSize: opt.id })
                          }
                          type="button"
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {activeTab === "data" && (
              <div className="space-y-4">
                <section className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#212121] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      Intelligent Multi-Key Router
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Sticky circuit-breaker cascades across Gemini, Groq, and
                    OpenRouter automatically on 429 or quota errors while
                    logging clean pairs to Supabase for future model training.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-zinc-300">
                    <span className="rounded-lg bg-[#171717] px-2.5 py-1">
                      Gemini Direct
                    </span>
                    <span className="rounded-lg bg-[#171717] px-2.5 py-1">
                      Groq Direct
                    </span>
                    <span className="rounded-lg bg-[#171717] px-2.5 py-1">
                      OpenRouter 300+
                    </span>
                    <span className="rounded-lg bg-[#171717] px-2.5 py-1">
                      Supabase training_logs
                    </span>
                  </div>
                </section>

                <section className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#212121] px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 active:scale-[0.98]"
                    onClick={handleExportConfig}
                    type="button"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-400" />
                        Copied JSON!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" />
                        Copy Config JSON
                      </>
                    )}
                  </button>
                  <button
                    className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 active:scale-[0.98]"
                    onClick={() => commit(DEFAULT_MIZUKI_CONFIG)}
                    type="button"
                  >
                    Reset Defaults
                  </button>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-secondary active:scale-95"
          onClick={() => openWithTab("tuning")}
          title="Switch profile or temperature"
          type="button"
        >
          <span className="max-w-[92px] truncate">{activeProfile.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {activeProfile.temperature.toFixed(1)}
          </span>
        </button>

        <button
          aria-label="Open Mizuki Settings"
          className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-95"
          onClick={() => openWithTab("personalization")}
          title="Settings"
          type="button"
        >
          <SettingsIcon className="size-4" />
        </button>
      </div>

      {mounted && open ? createPortal(modal, document.body) : null}
    </>
  );
}
