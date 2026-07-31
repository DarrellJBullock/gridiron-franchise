import { cn, ratingTone } from "@/lib/utils";

const TONE_STYLES: Record<ReturnType<typeof ratingTone>, string> = {
  elite: "bg-accent text-black",
  good: "bg-accent-blue/20 text-accent-blue border border-accent-blue/40",
  average: "bg-warning/20 text-warning border border-warning/40",
  weak: "bg-danger/20 text-danger border border-danger/40",
};

interface RatingBadgeProps {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-xl",
};

export function RatingBadge({ value, size = "md", className }: RatingBadgeProps) {
  const tone = ratingTone(value);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-bold tabular-nums",
        TONE_STYLES[tone],
        SIZES[size],
        className
      )}
    >
      {value}
    </span>
  );
}
