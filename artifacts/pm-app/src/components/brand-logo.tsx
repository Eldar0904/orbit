import { cn } from "@/lib/utils";

type BrandLogoProps = {
  inverse?: boolean;
  className?: string;
  imageClassName?: string;
  showProductName?: boolean;
};

export function BrandLogo({
  inverse = false,
  className,
  imageClassName,
  showProductName = true,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="PINE B2B">
      <img
        src={`${import.meta.env.BASE_URL}${inverse ? "pine-logo-white.png" : "pine-logo.png"}`}
        alt="PINE"
        className={cn("h-8 w-auto object-contain", imageClassName)}
      />
      {showProductName && (
        <span
          className={cn(
            "border-l pl-3 text-sm font-semibold tracking-[0.18em]",
            inverse ? "border-white/30 text-white" : "border-pine/25 text-pine-deep",
          )}
        >
          B2B
        </span>
      )}
    </div>
  );
}
