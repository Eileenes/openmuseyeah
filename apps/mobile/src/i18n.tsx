import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Interface language.
 *
 * Hand-rolled rather than pulling in a library: the surface is small, and a
 * dependency would have to be installed and versioned for every platform.
 *
 * English is the source of truth. A key missing from another dictionary falls
 * back to English and then to the key itself, so a partial translation degrades
 * into readable English instead of blanks or raw identifiers.
 */
export type Language = "en" | "zh";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
];

const en: Record<string, string> = {
  "nav.chat": "Chat",
  "nav.activity": "Activity",
  "nav.ideas": "Ideas",
  "nav.goals": "Goals",
  "nav.apps": "Apps",
  "nav.settings.language": "Language",

  "screen.activity.title": "Activity",
  "screen.activity.subtitle": "Plans, progress, decisions and results.",
  "screen.ideas.title": "Ideas",
  "screen.ideas.subtitle": "Useful next steps, grounded in your world.",
  "screen.goals.title": "Goals",
  "screen.goals.subtitle": "Longer-term goals and things to keep an eye on.",
  "screen.apps.title": "Apps",
  "screen.apps.subtitle": "Connections, capabilities and what your agent remembers.",
  "screen.connections.title": "Apps",
  "screen.connections.subtitle": "Connections and capabilities.",
  "screen.mail.title": "Mail",
  "screen.mail.subtitle": "The conversations behind your work.",
  "screen.calendar.title": "Calendar",
  "screen.calendar.subtitle": "Time for what matters.",
  "screen.browser.title": "Browser",
  "screen.browser.subtitle": "Your connected browsing sessions.",
  "screen.files.title": "Files",
  "screen.files.subtitle": "Documents, forms and filled copies.",

  "status.computerOffline": "Computer · offline",
  "status.computerOnline": "Computer · online",
  "status.working": "Working…",
  "status.saved": "Saved.",
};

const zh: Record<string, string> = {
  "nav.chat": "聊天",
  "nav.activity": "任务",
  "nav.ideas": "建议",
  "nav.goals": "目标",
  "nav.apps": "应用",
  "nav.settings.language": "语言",

  "screen.activity.title": "任务",
  "screen.activity.subtitle": "计划、进度、决策与结果。",
  "screen.ideas.title": "建议",
  "screen.ideas.subtitle": "基于你的世界给出的下一步建议。",
  "screen.goals.title": "目标",
  "screen.goals.subtitle": "长期目标，以及需要持续关注的事。",
  "screen.apps.title": "应用",
  "screen.apps.subtitle": "连接、能力，以及助手记住的内容。",
  "screen.connections.title": "应用",
  "screen.connections.subtitle": "连接与能力。",
  "screen.mail.title": "邮件",
  "screen.mail.subtitle": "工作背后的那些对话。",
  "screen.calendar.title": "日历",
  "screen.calendar.subtitle": "把时间留给重要的事。",
  "screen.browser.title": "浏览器",
  "screen.browser.subtitle": "你已连接的浏览会话。",
  "screen.files.title": "文件",
  "screen.files.subtitle": "文档、表单与填好的副本。",

  "status.computerOffline": "电脑 · 离线",
  "status.computerOnline": "电脑 · 在线",
  "status.working": "处理中…",
  "status.saved": "已保存。",
};

const dictionaries: Record<Language, Record<string, string>> = { en, zh };

const STORAGE_KEY = "vesper.language";

/**
 * The device's language decides the first run, so a Chinese phone opens in
 * Chinese without anyone hunting for a setting.
 */
function detectLanguage(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // Storage can be unavailable; fall through to the device locale.
  }
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    if (locale.toLowerCase().startsWith("zh")) return "zh";
  } catch {
    // No Intl: English is a safe default.
  }
  return "en";
}

interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageValue>({
  language: "en",
  setLanguage: () => undefined,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage);
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, language);
    } catch {
      // Persistence is a convenience here; the session still switches.
    }
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const { language } = useLanguage();
  const t = useCallback(
    (
      key: string,
      vars?: Record<string, string | number>,
      /** Used when the key exists in no dictionary; replaces writing a key per string. */
      fallback?: string,
    ) => {
      const template = dictionaries[language][key] ?? en[key] ?? fallback ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [language],
  );
  return { t, language };
}
