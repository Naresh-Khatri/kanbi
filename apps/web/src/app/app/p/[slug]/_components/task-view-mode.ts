export type TaskViewMode = "sheet" | "page";

const KEY = "kanbi:task-view";

export function getTaskViewMode(): TaskViewMode {
  try {
    return localStorage.getItem(KEY) === "page" ? "page" : "sheet";
  } catch {
    return "sheet";
  }
}

export function setTaskViewMode(mode: TaskViewMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}
