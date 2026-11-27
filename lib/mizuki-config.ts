export type MizukiProfile = {
  id: string;
  name: string;
  temperature: number;
  instructions: string;
  builtIn?: boolean;
};

export type MizukiFontSize = "sm" | "md" | "lg";

export type MizukiConfig = {
  activeProfileId: string;
  globalInstructions: string;
  profiles: MizukiProfile[];
  oledMode?: boolean;
  fontSize?: MizukiFontSize;
};

export const MIZUKI_STORAGE_KEY = "mizuki_workspace_config_v1";
export const MIZUKI_CONFIG_EVENT = "mizuki-config-updated";
export const MIZUKI_OPEN_SETTINGS_EVENT = "mizuki-open-settings";

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
  oledMode: false,
  fontSize: "md",
};

export function openMizukiSettings(
  tab?: "tuning" | "personalization" | "appearance" | "data"
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MIZUKI_OPEN_SETTINGS_EVENT, { detail: { tab } })
  );
}

export function applyMizukiAppearance(config: MizukiConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("mizuki-oled", Boolean(config.oledMode));
  root.classList.remove("mizuki-text-sm", "mizuki-text-lg");
  if (config.fontSize === "sm") root.classList.add("mizuki-text-sm");
  if (config.fontSize === "lg") root.classList.add("mizuki-text-lg");
}

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
      oledMode: Boolean(parsed.oledMode),
      fontSize:
        parsed.fontSize === "sm" || parsed.fontSize === "lg"
          ? parsed.fontSize
          : "md",
    };
  } catch {
    return DEFAULT_MIZUKI_CONFIG;
  }
}

export function saveMizukiConfig(config: MizukiConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIZUKI_STORAGE_KEY, JSON.stringify(config));
  applyMizukiAppearance(config);
  window.dispatchEvent(new Event(MIZUKI_CONFIG_EVENT));
}

export function getActiveProfile(config: MizukiConfig): MizukiProfile {
  return (
    config.profiles.find((p) => p.id === config.activeProfileId) ??
    config.profiles[0] ??
    DEFAULT_PROFILES[0]
  );
}
