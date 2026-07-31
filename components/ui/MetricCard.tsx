import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "accent" | "blue" | "success" | "danger";
  icon?: ReactNode;
}

const ACCENT_MAP: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  accent: "text-accent",
  blue: "text-accent-blue",
  success: "text-success",
  danger: "text-danger",
};

export function MetricCard({ label, value, hint, accent = "accent", icon }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
        {icon && <span className={cn("opacity-80", ACCENT_MAP[accent])}>{icon}</span>}
      </div>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums", ACCENT_MAP[accent])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-text-faint">{hint}</p>}
    </Card>
  );
}
