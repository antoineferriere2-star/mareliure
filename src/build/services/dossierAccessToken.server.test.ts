import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_BYTES,
  ACCESS_TOKEN_TTL_DAYS,
  accessTokenExpiryFromNow,
  generateAccessToken,
  hashAccessToken,
} from "./dossierAccessToken.server";

describe("generateAccessToken", () => {
  it("produces a hex string with the expected entropy", () => {
    const token = generateAccessToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token.length).toBe(ACCESS_TOKEN_BYTES * 2);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateAccessToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("hashAccessToken", () => {
  it("is deterministic for the same input", () => {
    const token = generateAccessToken();
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
  });

  it("never equals the raw token itself", () => {
    const token = generateAccessToken();
    expect(hashAccessToken(token)).not.toBe(token);
  });

  it("produces different hashes for different tokens", () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(hashAccessToken(a)).not.toBe(hashAccessToken(b));
  });
});

describe("accessTokenExpiryFromNow", () => {
  it("defaults to 90 days from the given time", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    expect(ACCESS_TOKEN_TTL_DAYS).toBe(90);
    expect(accessTokenExpiryFromNow(now)).toBe("2026-10-27T00:00:00.000Z");
  });
});
