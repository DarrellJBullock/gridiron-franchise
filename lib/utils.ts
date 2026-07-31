import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}'${remainder}"`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function ratingTone(value: number): "elite" | "good" | "average" | "weak" {
  if (value >= 90) return "elite";
  if (value >= 75) return "good";
  if (value >= 55) return "average";
  return "weak";
}
