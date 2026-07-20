import { useListMembers, useGetMemberWorkload, Member } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";

export default function Team() {
  const { data: members, isLoading } = useListMembers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage the people in your workspace.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map(member => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <div className="p-10 border border-dashed rounded-lg text-center text-muted-foreground">
          No team members found.
        </div>
      )}
    </div>
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
          <Badge variant={member.role === 'admin' ? "default" : "secondary"} className="text-[10px] uppercase font-bold tracking-wide">
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
