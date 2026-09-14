import {
  useUpdateProject,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  type Project,
  type Member,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PROJECT_STAGES, PROJECT_KINDS } from "@/lib/project-constants";
import { B2G_STAGES } from "@/lib/b2g-workflow";
import { Pencil } from "lucide-react";

export function EditProjectDialog({
  project,
  members,
}: {
  project: Project;
  members: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [projectType, setProjectType] = useState(project.projectType ?? "");
  const [kind, setKind] = useState(project.kind ?? "");
  const [stage, setStage] = useState(project.stage ?? "p1");
  const [location, setLocation] = useState(project.location ?? "");
  const [client, setClient] = useState(project.client ?? "");
  const [budget, setBudget] = useState(project.budget?.toString() ?? "");
  const [budgetSpent, setBudgetSpent] = useState(project.budgetSpent?.toString() ?? "0");
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [endDate, setEndDate] = useState(project.endDate ?? "");
  const [area, setArea] = useState(project.area?.toString() ?? "");
  const [rooms, setRooms] = useState(project.rooms?.toString() ?? "");
  const [floors, setFloors] = useState(project.floors?.toString() ?? "");
  const [note, setNote] = useState(project.note ?? "");
  const [managerIds, setManagerIds] = useState<number[]>(project.managerIds ?? []);

  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isB2GProject = project.projectType?.toLowerCase() === "b2g";

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setProjectType(project.projectType ?? "");
      setKind(project.kind ?? "");
      setStage(project.stage ?? "p1");
      setLocation(project.location ?? "");
      setClient(project.client ?? "");
      setBudget(project.budget?.toString() ?? "");
      setBudgetSpent(project.budgetSpent?.toString() ?? "0");
      setStartDate(project.startDate ?? "");
      setEndDate(project.endDate ?? "");
      setArea(project.area?.toString() ?? "");
      setRooms(project.rooms?.toString() ?? "");
      setFloors(project.floors?.toString() ?? "");
      setNote(project.note ?? "");
      setManagerIds(project.managerIds ?? []);
    }
  }, [open, project]);

  const toggleManager = (id: number) => {
    setManagerIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    updateProject.mutate(
      {
        id: project.id,
        data: {
          name,
          description: description || null,
          projectType: projectType || null,
          kind: (kind || null) as Project["kind"],
          stage: stage as Project["stage"],
          location: location || null,
          client: client || null,
          budget: budget ? parseInt(budget, 10) : null,
          budgetSpent: budgetSpent ? parseInt(budgetSpent, 10) : 0,
          startDate: startDate || null,
          endDate: endDate || null,
          area: area ? parseInt(area, 10) : null,
          rooms: rooms ? parseInt(rooms, 10) : null,
          floors: floors ? parseInt(floors, 10) : null,
          note: note || null,
          managerIds,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Project updated" });
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update project" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Input placeholder="e.g. School" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select value={kind || "none"} onValueChange={(v) => setKind(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select kind" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PROJECT_KINDS.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isB2GProject ? B2G_STAGES.map((s, index) => (
                    <SelectItem key={s.id} value={s.id}>{index + 1}. {s.label}</SelectItem>
                  )) : PROJECT_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.short} — {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Input value={client} onChange={(e) => setClient(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Budget</Label>
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Spent</Label>
                <Input type="number" value={budgetSpent} onChange={(e) => setBudgetSpent(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Area (m²)</Label>
                <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rooms</Label>
                <Input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Floors</Label>
                <Input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            {members.length > 0 && (
              <div className="space-y-2">
                <Label>Managers</Label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={managerIds.includes(m.id)}
                        onCheckedChange={() => toggleManager(m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!name || updateProject.isPending}>
              {updateProject.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
