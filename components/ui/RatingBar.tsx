import { cn, ratingTone } from "@/lib/utils";

const TONE_COLORS: Record<ReturnType<typeof ratingTone>, string> = {
  elite: "bg-accent",
  good: "bg-accent-blue",
  average: "bg-warning",
  weak: "bg-danger",
};

interface RatingBarProps {
  label: string;
  value: number;
  className?: string;
}

export function RatingBar({ label, value, className }: RatingBarProps) {
  const tone = ratingTone(value);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-32 shrink-0 truncate text-xs font-medium text-text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={cn("h-full rounded-full rating-fill", TONE_COLORS[tone])}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-text-primary">{value}</span>
    </div>
  );
}
