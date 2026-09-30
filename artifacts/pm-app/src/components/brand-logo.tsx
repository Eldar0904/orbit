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
  showProductName: _showProductName = true,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={inverse ? "/pine-logo-white.png" : "/pine-logo.png"}
        alt="PINE"
        className={cn("h-8 w-auto max-w-[10rem] object-contain", imageClassName)}
      />
    </div>
  );
}
