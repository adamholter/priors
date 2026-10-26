/** Keep removals chronological even when the page has several independent charts. */
export function createChartUndo() {
  let actions: { owner: object; undo: () => void }[] = [];
  return {
    record(owner: object, undo: () => void) { actions.push({ owner, undo }); },
    forget(owner: object) { actions = actions.filter(action => action.owner !== owner); },
    undo(owner?: object) {
      const at = owner ? actions.findLastIndex(action => action.owner === owner) : actions.length - 1;
      if (at < 0) return false;
      const [action] = actions.splice(at, 1);
      action.undo();
      return true;
    },
  };
}

export function isChartUndoKey(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented">) {
  return !event.defaultPrevented && !event.altKey && !event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z";
}

export const chartUndo = createChartUndo();
let users = 0;
function onKeyDown(event: KeyboardEvent) {
  if (!isChartUndoKey(event)) return;
  const target = event.target instanceof Element ? event.target : document.activeElement;
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  if (chartUndo.undo()) event.preventDefault();
}
export function listenForChartUndo() {
  if (users++ === 0) window.addEventListener("keydown", onKeyDown);
  return () => { if (--users === 0) window.removeEventListener("keydown", onKeyDown); };
}
