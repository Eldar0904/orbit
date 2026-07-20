import { Switch, Route, Redirect } from "wouter";
import { Show } from "@clerk/react";
import { AppLayout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import Projects from "./pages/projects";
import ProjectDetail from "./pages/project-detail";
import Tasks from "./pages/tasks";
import Team from "./pages/team";
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

export function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      {/* REQUIRED — /*? is the only wouter syntax matching both the bare URL
          and Clerk OAuth sub-paths like /sign-in/sso-callback */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={ProtectedApp} />
    </Switch>
  );
}
