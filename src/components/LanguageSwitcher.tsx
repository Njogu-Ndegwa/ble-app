"use client";

import { useI18n } from "@/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
      <label className="sr-only" htmlFor="lang-select">Language</label>
      <select
        id="lang-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as "en" | "fr" | "zh")}
        className="bg-bg-tertiary text-text-primary rounded px-2 py-1 border border-border focus:outline-none"
      >
        <option value="en">{t("common.language.english")}</option>
        <option value="fr">{t("common.language.french")}</option>
        <option value="zh">{t("common.language.chinese")}</option>
      </select>
    </div>
  );
}


