import { useGetDashboardSummary, useGetRecentActivity, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, AlertCircle, Clock, Briefcase, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity({ limit: 8 });
  const { data: projects, isLoading: isProjectsLoading } = useListProjects({ status: "active" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what's happening across your workspace.</p>
        </div>
      </div>

      {isSummaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}><CardContent className="h-28 flex items-center justify-center"><Skeleton className="h-full w-full" /></CardContent></Card>
          ))}
        </div>
      ) : summary && typeof summary === "object" && "totalProjects" in summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="flex items-center text-muted-foreground gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Active Projects</span>
              </div>
              <div className="text-3xl font-bold font-mono tracking-tight">{summary.activeProjects}</div>
              <p className="text-xs text-muted-foreground">Out of {summary.totalProjects} total</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="flex items-center text-muted-foreground gap-2">
                <LayoutDashboard className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Total Tasks</span>
              </div>
              <div className="text-3xl font-bold font-mono tracking-tight">{summary.totalTasks}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="flex items-center text-muted-foreground gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">In Progress</span>
              </div>
              <div className="text-3xl font-bold font-mono tracking-tight text-amber-600">{summary.inProgressTasks}</div>
              <p className="text-xs text-muted-foreground">Actively being worked on</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 flex flex-col gap-2">
              <div className="flex items-center text-muted-foreground gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Completion Rate</span>
              </div>
              <div className="text-3xl font-bold font-mono tracking-tight text-green-600">{(summary.completionRate ?? 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{summary.completedTasks ?? 0} completed tasks</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Active Projects</h2>
            <Link href="/projects" className="text-sm text-primary font-medium hover:underline">View all</Link>
          </div>
          
          {isProjectsLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.slice(0, 4).map(project => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block group">
                  <Card className="shadow-sm border-border/50 hover:border-primary/50 transition-colors h-full">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-4 space-y-0">
                      <div className="flex items-center gap-3 truncate">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: project.color || 'hsl(var(--primary))' }} 
                        />
                        <CardTitle className="text-base truncate">{project.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 text-sm text-muted-foreground">
                      <p className="truncate mb-3">{project.description || "No description"}</p>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span>Updated {format(new Date(project.updatedAt), "MMM d")}</span>
                        <span className="text-primary group-hover:underline">Open →</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <Briefcase className="w-10 h-10 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">No active projects right now.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Activity Feed</h2>
          </div>
          
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-0">
              {isActivityLoading ? (
                <div className="p-4 space-y-4">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="divide-y divide-border">
                  {activity.map(item => (
                    <div key={item.id} className="p-4 text-sm hover:bg-muted/50 transition-colors flex gap-3">
                      <div className="mt-0.5">
                        {item.type === 'task_completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {item.type === 'task_created' && <Activity className="w-4 h-4 text-blue-500" />}
                        {item.type === 'project_created' && <Briefcase className="w-4 h-4 text-primary" />}
                        {item.type.includes('updated') && <Clock className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">
                          {item.assigneeName && <span className="font-medium">{item.assigneeName}</span>}
                          {item.assigneeName ? " " : ""}
                          <span dangerouslySetInnerHTML={{ __html: item.title.replace(item.assigneeName || '', '') }} />
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                          {item.projectName && <span>{item.projectName}</span>}
                          {item.projectName && <span>•</span>}
                          <span>{format(new Date(item.createdAt), "MMM d, h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No recent activity to show.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
