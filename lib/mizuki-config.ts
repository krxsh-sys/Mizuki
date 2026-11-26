export type MizukiProfile = {
  id: string;
  name: string;
  temperature: number;
  instructions: string;
  builtIn?: boolean;
};

export type MizukiConfig = {
  activeProfileId: string;
  globalInstructions: string;
  profiles: MizukiProfile[];
};

export const MIZUKI_STORAGE_KEY = "mizuki_workspace_config_v1";
export const MIZUKI_CONFIG_EVENT = "mizuki-config-updated";

export const DEFAULT_PROFILES: MizukiProfile[] = [
  {
    id: "default",
    name: "Mizuki Core",
    temperature: 0.7,
    instructions:
      "Be sharp, clear, and direct. Skip filler intros and fluff. Match technical depth to the question.",
    builtIn: true,
  },
  {
    id: "coder",
    name: "Ship Mode",
    temperature: 0.2,
    instructions:
      "Act as a senior systems and full-stack engineer. Output clean, production-ready code with zero hand-holding or unnecessary commentary.",
    builtIn: true,
  },
  {
    id: "creative",
    name: "Unfiltered",
    temperature: 1.15,
    instructions:
      "Write with vivid voice, strong rhythm, and original phrasing. Avoid cliches and generic assistant phrasing.",
    builtIn: true,
  },
];

export const DEFAULT_MIZUKI_CONFIG: MizukiConfig = {
  activeProfileId: "default",
  globalInstructions: "",
  profiles: DEFAULT_PROFILES,
};

export function loadMizukiConfig(): MizukiConfig {
  if (typeof window === "undefined") return DEFAULT_MIZUKI_CONFIG;
  try {
    const raw = window.localStorage.getItem(MIZUKI_STORAGE_KEY);
    if (!raw) return DEFAULT_MIZUKI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<MizukiConfig>;
    const profiles =
      Array.isArray(parsed.profiles) && parsed.profiles.length > 0
        ? parsed.profiles
        : DEFAULT_PROFILES;
    const activeProfileId =
      parsed.activeProfileId &&
      profiles.some((p) => p.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0].id;
    return {
      activeProfileId,
      globalInstructions:
        typeof parsed.globalInstructions === "string"
          ? parsed.globalInstructions
          : "",
      profiles,
    };
  } catch {
    return DEFAULT_MIZUKI_CONFIG;
  }
}

export function saveMizukiConfig(config: MizukiConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIZUKI_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(MIZUKI_CONFIG_EVENT));
}

export function getActiveProfile(config: MizukiConfig): MizukiProfile {
  return (
    config.profiles.find((p) => p.id === config.activeProfileId) ??
    config.profiles[0] ??
    DEFAULT_PROFILES[0]
  );
}
