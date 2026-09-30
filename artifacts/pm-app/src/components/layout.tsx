import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, CheckSquare, Users, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, testId: "dashboard" },
  { href: "/projects", labelKey: "nav.projects", icon: Briefcase, testId: "projects" },
  { href: "/tasks", labelKey: "nav.tasks", icon: CheckSquare, testId: "all-tasks" },
  { href: "/team", labelKey: "nav.team", icon: Users, testId: "team" },
] as const;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-pine-deep bg-pine md:flex">
        <div className="flex h-20 items-center border-b border-white/15 px-5">
          <BrandLogo inverse imageClassName="h-7" />
        </div>

        <div className="flex-1 py-4 flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/dashboard" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                    isActive
                      ? "bg-white text-pine-deep shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                  data-testid={`nav-${item.testId}`}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.labelKey)}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-white/15 p-3 text-white">
          <LanguageSwitcher />
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? t("common.user")}
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover ring-2 ring-white/30"
              />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                <span className="text-xs font-semibold text-white">
                  {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
              {user?.fullName && (
                <p className="truncate text-xs text-white/60">
                  {user.emailAddresses?.[0]?.emailAddress ?? ""}
                </p>
              )}
            </div>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex-shrink-0 rounded-md p-1.5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              title={t("common.signOut")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-pine-deep bg-pine px-4 md:hidden">
          <BrandLogo inverse imageClassName="h-7" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title={t("common.signOut")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background">
          <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
