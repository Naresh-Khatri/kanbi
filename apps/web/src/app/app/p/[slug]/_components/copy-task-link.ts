import { toast } from "sonner";

/** Build a shareable URL that deep-links to a task and copy it to the clipboard. */
export function copyTaskLink(taskId: string) {
  const url = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
  navigator.clipboard.writeText(url).then(
    () => toast.success("Link copied"),
    () => toast.error("Couldn't copy link"),
  );
}
