import { isHydrated, whenHydrated } from "@/lib/hydration";

/** Keep a real click on the SSR application form until its React handlers exist. */
export function captureEarlyFormActions(doc: Document, start: () => void): () => void {
  if (isHydrated()) return () => undefined;
  const pending = new Set<() => void>();
  const capture = (event: MouseEvent) => {
    if (
      isHydrated() ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("#candidature button")
        : null;
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    start();
    pending.add(
      whenHydrated(() => {
        if (button.isConnected && !button.disabled) button.click();
      }),
    );
  };
  doc.addEventListener("click", capture, true);
  const stopReady = whenHydrated(() => doc.removeEventListener("click", capture, true));
  return () => {
    doc.removeEventListener("click", capture, true);
    stopReady();
    pending.forEach((stop) => stop());
    pending.clear();
  };
}
