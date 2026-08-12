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
    <div className={cn("flex items-center gap-2.5", className)} aria-label="PINE B2B">
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className={cn("h-8 w-8 shrink-0", imageClassName)}
      >
        <path
          fill="#D6A58C"
          fillRule="evenodd"
          d="M12 2h50v34c0 15.46-12.54 28-28 28H2V12C2 6.48 6.48 2 12 2Zm8 15h27v19c0 7.18-5.82 13-13 13H17V20c0-1.66 1.34-3 3-3Z"
          clipRule="evenodd"
        />
        <circle cx="33" cy="33" r="5" fill={inverse ? "#fff" : "#3B898E"} />
      </svg>
      {showProductName && (
        <span
          className={cn(
            "text-base font-bold tracking-[0.16em]",
            inverse ? "text-white" : "text-pine-deep",
          )}
        >
          B2B
        </span>
      )}
    </div>
  );
}
