import { AppLayout } from "./components/layout";
import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import Projects from "./pages/projects";
import ProjectDetail from "./pages/project-detail";
import Tasks from "./pages/tasks";
import Team from "./pages/team";
import NotFound from "./pages/not-found";

export function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/team" component={Team} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}
