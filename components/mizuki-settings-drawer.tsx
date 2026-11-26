"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_MIZUKI_CONFIG,
  getActiveProfile,
  loadMizukiConfig,
  MIZUKI_CONFIG_EVENT,
  type MizukiConfig,
  type MizukiProfile,
  saveMizukiConfig,
} from "@/lib/mizuki-config";

const TEMP_PRESETS = [
  { label: "Precise", value: 0.2 },
  { label: "Balanced", value: 0.7 },
  { label: "Creative", value: 1.2 },
];

export function MizukiSettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<MizukiConfig>(DEFAULT_MIZUKI_CONFIG);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setConfig(loadMizukiConfig());
    const sync = () => setConfig(loadMizukiConfig());
    window.addEventListener(MIZUKI_CONFIG_EVENT, sync);
    return () => window.removeEventListener(MIZUKI_CONFIG_EVENT, sync);
  }, []);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/90 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900"
        title="Mizuki Workspace Controls"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2" fill="currentColor" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2" fill="currentColor" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="11" cy="18" r="2" fill="currentColor" />
        </svg>
        <span className="max-w-[100px] truncate">{activeProfile.name}</span>
        <span className="font-mono text-[10px] text-zinc-500">
          {activeProfile.temperature.toFixed(1)}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />

          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-zinc-800/80 bg-[#09090b] text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-white">
                  Mizuki Controls
                </h2>
                <p className="text-xs text-zinc-500">
                  Profiles, temperature &amp; system instructions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close drawer"
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* Profiles */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Active Profile
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreating((v) => !v)}
                    className="text-xs text-zinc-400 transition hover:text-white"
                  >
                    {creating ? "Cancel" : "+ New"}
                  </button>
                </div>

                {creating && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateProfile();
                      }}
                      placeholder="Profile name (e.g. Exam Prep)"
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateProfile}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-zinc-200"
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
                        key={profile.id}
                        className={`inline-flex items-center rounded-lg border text-xs transition ${
                          isActive
                            ? "border-white bg-white text-black font-medium"
                            : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            commit({ ...config, activeProfileId: profile.id })
                          }
                          className="px-3 py-1.5"
                        >
                          {profile.name}
                        </button>
                        {!profile.builtIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            aria-label={`Delete ${profile.name}`}
                            className={`pr-2 text-[11px] opacity-60 hover:opacity-100 ${
                              isActive ? "text-black" : "text-zinc-400"
                            }`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Temperature */}
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Temperature
                  </span>
                  <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs text-white">
                    {activeProfile.temperature.toFixed(2)}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={activeProfile.temperature}
                  onChange={(e) =>
                    updateActiveProfile({
                      temperature: Number.parseFloat(e.target.value),
                    })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-white"
                />

                <div className="flex gap-2">
                  {TEMP_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        updateActiveProfile({ temperature: preset.value })
                      }
                      className={`flex-1 rounded-md border py-1 text-[11px] transition ${
                        Math.abs(activeProfile.temperature - preset.value) < 0.06
                          ? "border-zinc-500 bg-zinc-800 text-white"
                          : "border-zinc-800/80 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Profile Instructions */}
              <section className="space-y-2">
                <label
                  htmlFor="mizuki-profile-instructions"
                  className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400"
                >
                  Profile Instructions ({activeProfile.name})
                </label>
                <textarea
                  id="mizuki-profile-instructions"
                  rows={5}
                  value={activeProfile.instructions}
                  onChange={(e) =>
                    updateActiveProfile({ instructions: e.target.value })
                  }
                  placeholder="How should Mizuki behave in this profile?"
                  className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </section>

              {/* Global Instructions */}
              <section className="space-y-2">
                <label
                  htmlFor="mizuki-global-instructions"
                  className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400"
                >
                  Global Custom Instructions (All Chats)
                </label>
                <textarea
                  id="mizuki-global-instructions"
                  rows={4}
                  value={config.globalInstructions}
                  onChange={(e) =>
                    commit({ ...config, globalInstructions: e.target.value })
                  }
                  placeholder="Always remember these facts or rules across every profile..."
                  className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
              </section>
            </div>

            <div className="border-t border-zinc-800/80 px-5 py-3 text-[11px] text-zinc-500">
              Changes save automatically and apply on your next message.
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
