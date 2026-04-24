"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
// English is the source-of-truth translation file and serves two purposes
// here:
//   1. It seeds `messages` synchronously on first render so the very first
//      paint has real text instead of raw keys like "rider.nav.routeError".
//      Without this, the dynamic `import()` below only resolves on the
//      next microtask, leaving the user looking at dotted keys for a
//      perceptible flash — which is the bug riders reported as "the
//      message given seems to have no translation and it's the key which
//      is shown".
//   2. It acts as a per-key fallback when a non-English locale is active
//      but a specific key hasn't been translated yet. Better to render
//      English than the raw key.
import enMessages from "./messages/en.json";

type Messages = Record<string, string>;

type Locale = "en" | "fr" | "zh";

const EN_MESSAGES = enMessages as Messages;

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  isHydrated: boolean;
};

const I18N_STORAGE_KEY = "app_locale";

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, k) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k])), template);
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  
  // Try to get saved locale from localStorage
  const saved = window.localStorage.getItem(I18N_STORAGE_KEY) as Locale | null;
  if (saved === "en" || saved === "fr" || saved === "zh") return saved;
  
  // Fall back to browser language
  const browser = navigator.language?.toLowerCase?.() || "en";
  if (browser.startsWith("fr")) return "fr";
  if (browser.startsWith("zh")) return "zh";
  
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with default "en" for SSR, then hydrate with saved preference
  const [locale, setLocaleState] = useState<Locale>("en");
  const [isHydrated, setIsHydrated] = useState(false);
  // Seed with English synchronously so first paint has real text even
  // before the locale-specific JSON is fetched. See the import comment.
  const [messages, setMessages] = useState<Messages>(EN_MESSAGES);

  // Hydrate locale from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const savedLocale = getInitialLocale();
    setLocaleState(savedLocale);
    setIsHydrated(true);
  }, []);

  // Load messages when locale changes. We keep English as the baseline
  // and overlay the active locale on top, so a locale that's missing a
  // key renders the English string instead of the raw dotted key.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (locale === "en") {
        if (!cancelled) setMessages(EN_MESSAGES);
        return;
      }
      try {
        const mod = await import(`./messages/${locale}.json`);
        if (cancelled) return;
        setMessages({ ...EN_MESSAGES, ...(mod.default as Messages) });
      } catch (err) {
        console.warn(`[i18n] Failed to load locale "${locale}", falling back to English:`, err);
        if (!cancelled) setMessages(EN_MESSAGES);
      }
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

  const setLocale = useCallback((loc: Locale) => setLocaleState(loc), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // If a key isn't in the active locale, try English (covers locales
      // that are missing a translation for the key) and only fall through
      // to the raw key as a last-ditch signal to developers. The
      // `|| 'fallback'` pattern used everywhere in the codebase expects
      // this function to return empty/undefined when the key is truly
      // missing; in that case we return an empty string so the fallback
      // kicks in instead of showing the raw dotted key in the UI.
      const msg = messages[key] ?? EN_MESSAGES[key];
      if (msg == null) {
        if (process.env.NODE_ENV !== "production") {
          // Loud warn so missing keys are easy to spot in dev; silent in
          // production so end users see the caller-provided fallback.
          console.warn(`[i18n] Missing translation key: "${key}"`);
        }
        return "";
      }
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


