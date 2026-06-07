import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayName(name: string | null | undefined, fallback: string = "User"): string {
  if (!name) return fallback;
  let formatted = name.trim();
  
  // If it's an email prefix (contains dot, no spaces)
  if (formatted.includes(".") && !formatted.includes(" ")) {
    formatted = formatted
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  
  // Special case for the common 'sushmagouda' handle based on username
  if (formatted.toLowerCase().replace(/\s+/g, '').includes("sushmagouda")) {
    return "Sushma Gouda";
  }
  
  return formatted;
}
