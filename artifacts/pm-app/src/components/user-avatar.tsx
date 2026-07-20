import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Member } from "@workspace/api-client-react";

export function UserAvatar({ member, className }: { member?: Member | null, className?: string }) {
  if (!member) {
    return (
      <Avatar className={className}>
        <AvatarFallback className="bg-slate-100 text-slate-400 text-xs">?</AvatarFallback>
      </Avatar>
    );
  }

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Avatar className={className}>
      {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
