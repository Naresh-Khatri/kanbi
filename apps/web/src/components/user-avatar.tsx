import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeAvatarUrl } from "@/lib/avatar";

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
  /** px */
  size?: number;
  className?: string;
}) {
  const src = normalizeAvatarUrl(image);
  return (
    <Avatar
      className={className}
      style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
    >
      {src ? <AvatarImage alt="" src={src} /> : null}
      <AvatarFallback>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}
