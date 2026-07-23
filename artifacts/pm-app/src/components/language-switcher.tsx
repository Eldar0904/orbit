import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  setAppLocale,
  type AppLocale,
} from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LOCALES.includes(i18n.language as AppLocale)
    ? i18n.language
    : "ru") as AppLocale;

  return (
    <Select
      value={current}
      onValueChange={(value) => setAppLocale(value as AppLocale)}
    >
      <SelectTrigger
        className={compact ? "h-9 w-[130px]" : "h-9 w-full"}
        aria-label={t("common.language")}
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
