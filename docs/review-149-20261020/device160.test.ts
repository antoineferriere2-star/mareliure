import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deviceClass } from "../../src/build/analytics/deviceClass";
const agents = JSON.parse(
  readFileSync(new URL("./user-agents160.json", import.meta.url), "utf8"),
) as Array<{ name: string; ua: string; expected: "bot" | "mobile" | "tablet" | "desktop" }>;
describe("#160 representative browser and automation User-Agent fixtures", () => {
  for (const agent of agents)
    it(agent.name, () => expect(deviceClass(agent.ua)).toBe(agent.expected));
  it("a headed automation browser with an ordinary Chrome UA cannot be distinguished from a person by UA alone", () => {
    const chrome = agents.find((a) => a.name === "Chrome desktop")!;
    expect(deviceClass(chrome.ua)).toBe("desktop");
  });
});
