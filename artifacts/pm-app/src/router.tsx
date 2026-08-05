import type { ReactNode } from "react";
import { Switch, Route, Redirect } from "wouter";
import { ClerkFailed, ClerkLoaded, ClerkLoading, Show } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import Projects from "./pages/projects";
import ProjectDetail from "./pages/project-detail";
import Tasks from "./pages/tasks";
import Team from "./pages/team";
import Catalogs from "./pages/catalogs";
import ImportMatch from "./pages/import-match";
import NotFound from "./pages/not-found";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import LandingPage from "./pages/landing";

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedApp() {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/tasks" component={Tasks} />
            <Route path="/catalogs" component={Catalogs} />
            <Route path="/import-match" component={ImportMatch} />
            <Route path="/team" component={Team} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <>
      <ClerkLoading>
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f7f3]">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </div>
      </ClerkLoading>
      <ClerkFailed>
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f7f3] px-4">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">
              {t("auth.authFailedTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("auth.authFailedBody")}
            </p>
          </div>
        </div>
      </ClerkFailed>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  );
}

export function Router() {
  return (
    <AuthShell>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        {/* REQUIRED — /*? is the only wouter syntax matching both the bare URL
            and Clerk OAuth sub-paths like /sign-in/sso-callback */}
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={ProtectedApp} />
      </Switch>
    </AuthShell>
  );
}
