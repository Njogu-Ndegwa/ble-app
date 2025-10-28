"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Messages = Record<string, string>;

type I18nContextValue = {
  locale: "en" | "fr";
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: "en" | "fr") => void;
};

const I18N_STORAGE_KEY = "app_locale";

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), template);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<"en" | "fr">(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem(I18N_STORAGE_KEY) as "en" | "fr" | null;
    if (saved === "en" || saved === "fr") return saved;
    const browser = navigator.language?.toLowerCase?.() || "en";
    if (browser.startsWith("fr")) return "fr";
    return "en";
  });

  const [messages, setMessages] = useState<Messages>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import(`./messages/${locale}.json`);
      if (!cancelled) setMessages(mod.default as Messages);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    }
  }, [locale]);

  const setLocale = useCallback((loc: "en" | "fr") => setLocaleState(loc), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const msg = messages[key] ?? key;
      return interpolate(msg, vars);
    },
    [messages]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}


