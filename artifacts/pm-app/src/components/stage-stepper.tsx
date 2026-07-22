import { cn } from "@/lib/utils";
import { PROJECT_STAGES, type ProjectStageId } from "@/lib/project-constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function StageStepper({
  stage,
  compact = false,
  className,
}: {
  stage: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const current = (stage ?? "p1") as ProjectStageId;
  const currentIndex = PROJECT_STAGES.findIndex((s) => s.id === current);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-center gap-1", className)}>
        {PROJECT_STAGES.map((s, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "rounded-full transition-colors flex items-center justify-center font-mono font-medium",
                    compact ? "h-2 w-2" : "h-6 w-6 text-[10px]",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1",
                    isPast && !isCurrent && "bg-primary/60 text-primary-foreground",
                    !isPast && !isCurrent && "bg-muted text-muted-foreground",
                  )}
                >
                  {!compact && s.short}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {s.short}: {s.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
