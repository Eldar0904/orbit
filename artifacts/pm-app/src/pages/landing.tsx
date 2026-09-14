import { Link } from "wouter";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Building2, CheckCircle2, Landmark, Layers3, Sparkles } from "lucide-react";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] bg-[#f8f7f3] text-pine-ink">
      <header className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-10">
        <BrandLogo imageClassName="h-9" productName="PINE" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link href="/sign-in" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-pine-deep hover:bg-pine/10 sm:block">
            {t("landing.signIn")}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-[1440px] items-stretch px-4 pb-4 sm:px-6 sm:pb-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:pb-10">
        <section className="flex flex-col justify-center px-4 py-16 sm:px-8 lg:px-10 lg:py-20">
          <div className="mb-8 flex w-fit items-center gap-2 rounded-full border border-pine/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-pine-deep shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-sand-deep" />
            {t("landing.eyebrow")}
          </div>
          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-pine-ink sm:text-6xl xl:text-7xl">
            {t("landing.headline")}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-pine-muted sm:text-xl">
            {t("landing.subheadline")}
          </p>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
            <WorkspaceOption href="/sign-in?workspace=b2b" icon={<Building2 className="h-5 w-5" />} title={t("landing.b2bOption.title")} description={t("landing.b2bOption.description")} action={t("landing.b2bOption.action")} />
            <WorkspaceOption href="/sign-in?workspace=b2g" icon={<Landmark className="h-5 w-5" />} title={t("landing.b2gOption.title")} description={t("landing.b2gOption.description")} action={t("landing.b2gOption.action")} featured />
          </div>
          <Link href="/sign-up" className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-pine-deep hover:text-pine">{t("landing.createAccount")} <ArrowRight className="h-4 w-4" /></Link>
          <div className="mt-12 grid max-w-2xl gap-4 border-t border-pine/15 pt-6 text-sm text-pine-muted sm:grid-cols-3">
            {["projects", "delivery", "team"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-pine" />
                {t(`landing.features.${item}`)}
              </div>
            ))}
          </div>
        </section>

        <section className="pine-pattern relative hidden min-h-[620px] overflow-hidden rounded-[2.5rem_2.5rem_9rem_2.5rem] bg-pine lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-pine-deep/10 via-transparent to-pine-deep/45" />
          <div className="absolute left-10 top-10 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
            {t("landing.workspace")}
          </div>
          <div className="absolute inset-x-10 bottom-10 rounded-[2rem] border border-white/15 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-md">
            <Layers3 className="mb-8 h-8 w-8 text-sand" />
            <p className="font-display text-3xl leading-tight">{t("landing.panelTitle")}</p>
            <p className="mt-4 max-w-md leading-7 text-white/70">{t("landing.panelBody")}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function WorkspaceOption({ href, icon, title, description, action, featured = false }: { href: string; icon: ReactNode; title: string; description: string; action: string; featured?: boolean }) {
  return <Link href={href} className={`group rounded-2xl border p-5 transition-all ${featured ? "border-pine bg-pine text-white shadow-lg shadow-pine/15 hover:bg-pine-deep" : "border-pine/20 bg-white text-pine-ink hover:border-pine/45 hover:shadow-md"}`}>
    <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${featured ? "bg-white/15 text-sand" : "bg-pine/10 text-pine"}`}>{icon}</div>
    <h2 className="text-lg font-bold">{title}</h2>
    <p className={`mt-1.5 min-h-10 text-sm leading-5 ${featured ? "text-white/75" : "text-pine-muted"}`}>{description}</p>
    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
  </Link>;
}
