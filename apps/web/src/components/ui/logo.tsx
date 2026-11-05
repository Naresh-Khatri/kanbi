import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fillOpacity="0.35" height="12" rx="1.5" width="12" x="3" y="8" />
      <rect fillOpacity="0.65" height="12" rx="1.5" width="12" x="6" y="6" />
      <rect height="12" rx="1.5" width="12" x="9" y="4" />
    </svg>
  );
}

/** logo + name lockup for auth / standalone pages */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo className="h-8 w-8" />
      <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
    </span>
  );
}
