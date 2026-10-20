import { describe, expect, it, vi } from "vitest";
import { startHydration } from "./firstPaint";
function fixture() {
  const frames: (() => void)[] = [];
  const events = new Map<string, () => void>();
  const hydrate = vi.fn();
  const host = {
    requestFrame: (callback: () => void) => {
      frames.push(callback);
    },
    listen: (name: string, callback: () => void) => {
      events.set(name, callback);
      return () => events.delete(name);
    },
  };
  return { frames, events, hydrate, host };
}
describe("first public paint before hydration", () => {
  it("starts private and background pages immediately without scheduling", () => {
    const f = fixture();
    startHydration(f.hydrate, false, f.host);
    expect(f.hydrate).toHaveBeenCalledTimes(1);
    expect(f.frames).toHaveLength(0);
    expect(f.events.size).toBe(0);
  });
  it("allows an SSR paint and then starts only once", () => {
    const f = fixture();
    startHydration(f.hydrate, true, f.host);
    expect(f.hydrate).not.toHaveBeenCalled();
    f.frames.shift()!();
    expect(f.hydrate).not.toHaveBeenCalled();
    f.frames.shift()!();
    expect(f.hydrate).toHaveBeenCalledTimes(1);
    expect(f.events.size).toBe(0);
  });
  it.each(["pointerdown", "keydown", "focusin", "visibilitychange"])(
    "starts immediately on %s and removes listeners",
    (name) => {
      const f = fixture();
      startHydration(f.hydrate, true, f.host);
      f.events.get(name)!();
      expect(f.hydrate).toHaveBeenCalledTimes(1);
      expect(f.events.size).toBe(0);
      f.frames.shift()!();
      f.frames.shift()!();
      expect(f.hydrate).toHaveBeenCalledTimes(1);
    },
  );
});
