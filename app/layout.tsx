import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  description:
    "Mizuki — High-speed multi-provider AI workspace with adaptive routing, custom profiles, and real-time controls.",
  title: "Mizuki",
};

export const viewport = {
  maximumScale: 1,
  viewportFit: "cover" as const,
};

const geist = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "#ffffff";
const DARK_THEME_COLOR = "#212121";
const OLED_THEME_COLOR = "#000000";

const THEME_COLOR_SCRIPT = `(function() {
  var html = document.documentElement;
  try {
    var raw = localStorage.getItem('mizuki_workspace_config_v1');
    if (raw) {
      var cfg = JSON.parse(raw);
      if (cfg.oledMode) html.classList.add('mizuki-oled');
      if (cfg.fontSize === 'sm') html.classList.add('mizuki-text-sm');
      if (cfg.fontSize === 'lg') html.classList.add('mizuki-text-lg');
    }
  } catch (e) {}
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    var isOled = html.classList.contains('mizuki-oled');
    meta.setAttribute('content', isDark ? (isOled ? '${OLED_THEME_COLOR}' : '${DARK_THEME_COLOR}') : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required for FOUC-free theme color"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem
        >
          <SessionProvider
            basePath={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`}
          >
            <TooltipProvider>{children}</TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
