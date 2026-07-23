import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher compact />
      </div>

      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <div className="w-4 h-4 rounded-sm bg-white/90" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {t("common.appName")}
          </span>
        </div>

        {/* Headline */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            {t("landing.headline")}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("landing.subheadline")}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link href="/sign-in">
            <button className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm">
              {t("landing.signIn")}
            </button>
          </Link>
          <Link href="/sign-up">
            <button className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-border bg-white text-foreground font-medium hover:bg-muted transition-colors">
              {t("landing.createAccount")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
