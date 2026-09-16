import {
  useUpdateProject,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  type Project,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";

export function EditProjectDialog({
  project,
  workspace,
}: {
  project: Project;
  workspace: "b2b" | "b2g";
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");

  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [open, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    updateProject.mutate(
      {
        id: project.id,
        data: {
          name,
          description: description || null,
          managerIds: [],
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("editProject.updated") });
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: t("editProject.updateFailed") }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-2" />
          {t("common.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("editProject.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("editProject.name")}</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">{t("projectDetail.description")}</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <DeleteProjectDialog project={project} workspace={workspace} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={!name || updateProject.isPending}>
                {updateProject.isPending ? t("common.saving") : t("editProject.saveChanges")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
