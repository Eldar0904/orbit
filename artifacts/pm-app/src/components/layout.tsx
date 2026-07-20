import { Link, useLocation } from "wouter";
import { LayoutDashboard, Briefcase, CheckSquare, Users, LogOut } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useClerk, useUser } from "@clerk/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/tasks", label: "All Tasks", icon: CheckSquare },
  { href: "/team", label: "Team", icon: Users },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="h-14 flex items-center px-4 font-bold text-lg tracking-tight text-foreground border-b border-border gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
            <div className="w-2 h-2 rounded-sm bg-white" />
          </div>
          Orbit
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
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* User section */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? "User"}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
              {user?.fullName && (
                <p className="text-xs text-muted-foreground truncate">
                  {user.emailAddresses?.[0]?.emailAddress ?? ""}
                </p>
              )}
            </div>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="h-14 flex md:hidden items-center justify-between px-4 border-b border-border bg-card">
          <span className="font-bold text-lg">Orbit</span>
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background">
          <div className="p-6 md:p-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
