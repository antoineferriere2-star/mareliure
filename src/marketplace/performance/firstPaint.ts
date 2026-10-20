type PaintHost = {
  requestFrame: (callback: () => void) => void;
  listen: (
    name: "pointerdown" | "keydown" | "focusin" | "visibilitychange",
    callback: () => void,
  ) => () => void;
};

/** Gives the existing SSR document a paint before evaluating the hydration runtime. */
export function startHydration(hydrate: () => void, defer: boolean, host: PaintHost): () => void {
  let started = false;
  const unsubscribe: (() => void)[] = [];
  const start = () => {
    if (started) return;
    started = true;
    unsubscribe.forEach((stop) => stop());
    hydrate();
  };
  if (!defer) {
    start();
    return start;
  }
  for (const name of ["pointerdown", "keydown", "focusin", "visibilitychange"] as const) {
    unsubscribe.push(host.listen(name, start));
  }
  host.requestFrame(() => host.requestFrame(start));
  return start;
}
