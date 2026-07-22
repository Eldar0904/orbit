import {
  useListMembers,
  useCreateMember,
  useGetMemberWorkload,
  getListMembersQueryKey,
  type Member,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users } from "lucide-react";

export default function Team() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: members, isLoading } = useListMembers();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the people in your workspace.</p>
        </div>
        <AddMemberDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed rounded-lg bg-card/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">No team members yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Add people to assign tasks and set project managers.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      )}
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const createMember = useCreateMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({ variant: "destructive", title: "Name and email are required" });
      return;
    }

    createMember.mutate(
      {
        data: {
          name: name.trim(),
          email: email.trim(),
          role,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Team member added" });
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setName("");
          setEmail("");
          setRole("member");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to add member" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                placeholder="e.g. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMember.isPending}>
              {createMember.isPending ? "Adding…" : "Add Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberCard({ member }: { member: Member }) {
  const { data: workload, isLoading } = useGetMemberWorkload(member.id);

  return (
    <Card className="shadow-sm border-border/50 hover:border-border transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <UserAvatar member={member} className="w-12 h-12 text-base" />
            <div>
              <h3 className="font-bold tracking-tight">{member.name}</h3>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <Badge variant={member.role === "admin" ? "default" : "secondary"} className="text-[10px] uppercase font-bold tracking-wide">
            {member.role}
          </Badge>
        </div>

        <div className="bg-muted/30 rounded-md p-4 mt-6">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-tight mb-3">Workload</h4>

          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : workload ? (
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-border">
              <div>
                <div className="text-xl font-bold font-mono text-slate-700">{workload.todo}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">To Do</div>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-blue-600">{workload.inProgress}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Progress</div>
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-green-600">{workload.done}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase mt-1">Done</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-center text-muted-foreground py-2">No active tasks</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
