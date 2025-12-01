"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Messages = Record<string, string>;

type I18nContextValue = {
  locale: "en" | "fr";
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: "en" | "fr") => void;
  isHydrated: boolean;
};

const I18N_STORAGE_KEY = "app_locale";

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), template);
}

function getInitialLocale(): "en" | "fr" {
  if (typeof window === "undefined") return "en";
  
  // Try to get saved locale from localStorage
  const saved = window.localStorage.getItem(I18N_STORAGE_KEY) as "en" | "fr" | null;
  if (saved === "en" || saved === "fr") return saved;
  
  // Fall back to browser language
  const browser = navigator.language?.toLowerCase?.() || "en";
  if (browser.startsWith("fr")) return "fr";
  
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with default "en" for SSR, then hydrate with saved preference
  const [locale, setLocaleState] = useState<"en" | "fr">("en");
  const [isHydrated, setIsHydrated] = useState(false);
  const [messages, setMessages] = useState<Messages>({});

  // Hydrate locale from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const savedLocale = getInitialLocale();
    setLocaleState(savedLocale);
    setIsHydrated(true);
  }, []);

  // Load messages when locale changes
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

  // Persist locale to localStorage and update document lang
  useEffect(() => {
    if (!isHydrated) return; // Don't save during initial hydration
    
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    }
  }, [locale, isHydrated]);

  const setLocale = useCallback((loc: "en" | "fr") => setLocaleState(loc), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const msg = messages[key] ?? key;
      return interpolate(msg, vars);
    },
    [messages]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, t, setLocale, isHydrated }), [locale, t, setLocale, isHydrated]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}


