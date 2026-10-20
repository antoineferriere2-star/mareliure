import { afterEach, describe, expect, it, vi } from "vitest";

class Target {
  constructor(private readonly button: unknown) {}
  closest() {
    return this.button;
  }
}

afterEach(() => vi.unstubAllGlobals());

async function fixture(alreadyReady = false) {
  vi.resetModules();
  vi.stubGlobal("Element", Target);
  const ready = await import("@/lib/hydration");
  const { captureEarlyFormActions } = await import("./earlyFormActions");
  const listeners = new Map<string, (event: MouseEvent) => void>();
  const doc = {
    addEventListener: (name: string, handler: (event: MouseEvent) => void) =>
      listeners.set(name, handler),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as Document;
  const button = { disabled: false, isConnected: true, click: vi.fn() };
  const event = {
    target: new Target(button),
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as MouseEvent;
  if (alreadyReady) ready.markHydrated();
  const start = vi.fn();
  const stop = captureEarlyFormActions(doc, start);
  return { ready, listeners, button, event, start, stop };
}

describe("application form actions before hydration", () => {
  it("keeps a real click until handlers exist, then replays it once", async () => {
    const f = await fixture();
    f.listeners.get("click")!(f.event);
    expect(f.event.preventDefault).toHaveBeenCalledOnce();
    expect(f.event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(f.start).toHaveBeenCalledOnce();
    expect(f.button.click).not.toHaveBeenCalled();
    f.ready.markHydrated();
    f.ready.markHydrated();
    expect(f.button.click).toHaveBeenCalledOnce();
    expect(f.listeners.size).toBe(0);
  });
  it("does not activate a disabled control", async () => {
    const f = await fixture();
    f.button.disabled = true;
    f.listeners.get("click")!(f.event);
    f.ready.markHydrated();
    expect(f.start).not.toHaveBeenCalled();
    expect(f.button.click).not.toHaveBeenCalled();
    expect(f.event.preventDefault).not.toHaveBeenCalled();
  });
  it("drops a queued action when its control was removed", async () => {
    const f = await fixture();
    f.listeners.get("click")!(f.event);
    f.button.isConnected = false;
    f.ready.markHydrated();
    expect(f.button.click).not.toHaveBeenCalled();
  });
  it("cancels pending actions on disposal", async () => {
    const f = await fixture();
    f.listeners.get("click")!(f.event);
    f.stop();
    f.ready.markHydrated();
    expect(f.button.click).not.toHaveBeenCalled();
    expect(f.listeners.size).toBe(0);
  });
  it("leaves native links and modified clicks untouched", async () => {
    const f = await fixture();
    f.listeners.get("click")!({ ...f.event, target: new Target(null) } as unknown as MouseEvent);
    f.listeners.get("click")!({ ...f.event, ctrlKey: true } as MouseEvent);
    expect(f.start).not.toHaveBeenCalled();
    expect(f.event.preventDefault).not.toHaveBeenCalled();
  });
  it("does not intercept an already hydrated form", async () => {
    const f = await fixture(true);
    expect(f.listeners.size).toBe(0);
  });
});
