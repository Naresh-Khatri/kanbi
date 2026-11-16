import { taskBoardHref } from "@/lib/task-link";
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

// board link, not the page one -> opens in each viewer's saved view
export function copyTaskLink(projectSlug: string, number: number) {
  return copyText(
    `${window.location.origin}${taskBoardHref(projectSlug, number)}`,
    "Link copied",
  );
}

// board-only: path is /app/p/<slug>; avoids useParams in every card (re-renders on url sync)
export function copyBoardTaskLink(number: number) {
  return copyText(
    `${window.location.origin}${window.location.pathname}?task=${number}`,
    "Link copied",
  );
}
