"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  DEFAULT_MIZUKI_CONFIG,
  getActiveProfile,
  loadMizukiConfig,
  MIZUKI_CONFIG_EVENT,
} from "@/lib/mizuki-config";

export const Greeting = () => {
  const [profileName, setProfileName] = useState(
    getActiveProfile(DEFAULT_MIZUKI_CONFIG).name
  );

  useEffect(() => {
    const sync = () => {
      setProfileName(getActiveProfile(loadMizukiConfig()).name);
    };
    sync();
    window.addEventListener(MIZUKI_CONFIG_EVENT, sync);
    return () => window.removeEventListener(MIZUKI_CONFIG_EVENT, sync);
  }, []);

  return (
    <div
      className="flex flex-col items-center px-6 text-center"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-border/60 bg-secondary/80 text-base font-bold tracking-tight text-foreground shadow-[var(--shadow-card)]"
        initial={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        M
      </motion.div>
      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-[30px]"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        What&apos;s on your mind?
      </motion.h1>
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 text-xs text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: 0.16, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        Running <span className="font-medium text-foreground/80">{profileName}</span> · Multi-provider adaptive routing
      </motion.p>
    </div>
  );
};
