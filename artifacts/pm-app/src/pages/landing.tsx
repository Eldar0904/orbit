import { Link } from "wouter";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Building2, Landmark } from "lucide-react";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] bg-[#f8f7f3] text-pine-ink">
      <header className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-10">
        <BrandLogo imageClassName="h-9" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link href="/sign-in" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-pine-deep hover:bg-pine/10 sm:block">
            {t("landing.signIn")}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[980px] items-center px-6 pb-20">
        <section className="w-full">
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceOption href="/sign-in?workspace=b2b" icon={<Building2 className="h-5 w-5" />} title={t("landing.b2bOption.title")} description={t("landing.b2bOption.description")} action={t("landing.b2bOption.action")} />
            <WorkspaceOption href="/sign-in?workspace=b2g" icon={<Landmark className="h-5 w-5" />} title={t("landing.b2gOption.title")} description={t("landing.b2gOption.description")} action={t("landing.b2gOption.action")} featured />
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
