import { toastManager } from "@/components/ui/toast";

export function copyText(text: string, successTitle: string) {
  return navigator.clipboard.writeText(text).then(
    () => {
      toastManager.add({ type: "success", title: successTitle });
      return true;
    },
    () => {
      toastManager.add({ type: "error", title: "Couldn't copy" });
      return false;
    },
  );
}

/** Build a shareable URL that deep-links to a task and copy it to the clipboard. */
export function copyTaskLink(taskId: string) {
  const url = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
  return copyText(url, "Link copied");
}
