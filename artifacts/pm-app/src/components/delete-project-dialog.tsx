import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { getListProjectsQueryKey, type Project, useDeleteProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function DeleteProjectDialog({ project, workspace }: { project: Project; workspace: "b2b" | "b2g" }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const removeProject = () => {
    if (confirmation.trim() !== project.name) return;
    deleteProject.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Проект удален" });
          setLocation(workspace === "b2g" ? "/b2g/projects" : "/projects");
        },
        onError: () => toast({ variant: "destructive", title: "Не удалось удалить проект" }),
      },
    );
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground">
        <Trash2 className="mr-2 h-4 w-4" />Удалить проект
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader><DialogTitle>Удалить проект?</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-sm leading-6 text-muted-foreground">Будут удалены проект «{project.name}», все его задачи и документы. Это действие нельзя отменить.</p>
        <div className="space-y-2">
          <Label htmlFor="project-delete-confirmation">Введите название проекта для подтверждения</Label>
          <Input id="project-delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={project.name} autoComplete="off" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
        <Button variant="destructive" onClick={removeProject} disabled={confirmation.trim() !== project.name || deleteProject.isPending}>{deleteProject.isPending ? "Удаление…" : "Удалить проект"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
