import { cn } from "@/lib/utils";

type BrandLogoProps = {
  inverse?: boolean;
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({
  inverse = false,
  className,
  imageClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center", className)} aria-label="PINE">
      <img
        src={inverse ? "/pine-logo-white.png" : "/pine-logo.png"}
        alt="PINE"
        className={cn("h-8 w-auto object-contain", imageClassName)}
      />
    </div>
  );
}
