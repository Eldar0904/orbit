import { useListProjects, useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Briefcase, Plus, Search, FolderClosed, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Projects() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: projects, isLoading } = useListProjects();
  
  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track your workspace projects.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9 bg-card border-border/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full shadow-sm border-border/50 hover:border-primary/50 transition-colors group cursor-pointer">
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3 truncate">
                      <div 
                        className="w-3.5 h-3.5 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: project.color || 'hsl(var(--primary))' }} 
                      />
                      <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                    </div>
                    <div className="text-xs font-mono px-2 py-1 bg-muted rounded text-muted-foreground">
                      {project.status.toUpperCase()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">
                    {project.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-muted-foreground font-mono">
                      Updated {format(new Date(project.updatedAt), "MMM d, yyyy")}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-slate-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed rounded-lg bg-card/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <FolderClosed className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">No projects found</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            {search ? "No projects match your search criteria." : "You haven't created any projects yet. Get started by creating your first project."}
          </p>
          {!search && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createProject.mutate({
      data: { name, description, color, status: "active" }
    }, {
      onSuccess: () => {
        toast({ title: "Project created successfully" });
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setName("");
        setDescription("");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to create project" });
      }
    });
  };

  const colors = ["#4f46e5", "#0ea5e9", "#0284c7", "#0d9488", "#16a34a", "#eab308", "#f97316", "#ef4444", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input 
                id="name" 
                placeholder="e.g. Q3 Marketing Site" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="Briefly describe what this project is about..." 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Project Color</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name || createProject.isPending}>
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
