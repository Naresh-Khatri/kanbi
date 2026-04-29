import { cn } from "@/lib/utils";

function initialsOf(name: string | null | undefined) {
  if (!name) return "?";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function UserAvatar({
  name,
  image,
  size = 24,
  className,
}: {
  name: string | null | undefined;
  image: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (image) {
    return (
      <img
        alt=""
        className={cn(
          "shrink-0 rounded-full border border-white/10 object-cover",
          className,
        )}
        src={image}
        style={style}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.65em] font-medium text-white/80",
        className,
      )}
      style={style}
    >
      {initialsOf(name)}
    </span>
  );
}
