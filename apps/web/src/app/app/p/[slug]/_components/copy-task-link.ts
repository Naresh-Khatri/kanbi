import { toastManager } from "@/components/ui/toast";

/** Build a shareable URL that deep-links to a task and copy it to the clipboard. */
export function copyTaskLink(taskId: string) {
  const url = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
  navigator.clipboard.writeText(url).then(
    () => toastManager.add({ type: "success", title: "Link copied" }),
    () => toastManager.add({ type: "error", title: "Couldn't copy link" }),
  );
}
