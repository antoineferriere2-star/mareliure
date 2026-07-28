import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";
import { logOperationalError, sanitizeOperationalMetadata } from "./operationalLog.server";

describe("operational logging", () => {
  it("redacts secrets, tokens, emails and image payloads from metadata", () => {
    expect(
      sanitizeOperationalMetadata({
        workspaceId: "workspace-1",
        email: "client@example.com",
        session_secret: "secret-value",
        publicToken: "token-value",
        image_base64: "base64-value",
        nested: { authorization: "Bearer secret", safe: "ok" },
      }),
    ).toEqual({
      workspaceId: "workspace-1",
      email: "[redacted]",
      session_secret: "[redacted]",
      publicToken: "[redacted]",
      image_base64: "[redacted]",
      nested: { authorization: "[redacted]", safe: "ok" },
    });
  });

  it("logs a structured event without leaking sensitive metadata", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logOperationalError("runtime.failure", new Error("boom"), {
      action: "submit_session",
      session_secret: "secret-value",
      dossierId: "dossier-1",
    });

    expect(spy).toHaveBeenCalledWith("[metre-build] runtime.failure", {
      error: { name: "Error", message: "boom" },
      metadata: {
        action: "submit_session",
        session_secret: "[redacted]",
        dossierId: "dossier-1",
      },
    });
    spy.mockRestore();
  });
});

const redactedLoggingSurfaces = [
  "src/routes/api/public/build-public-intake.ts",
  "src/routes/api/public/payments/webhook.ts",
  "src/build/services/provisionWorkspace.functions.ts",
] as const;

describe("operational logging contract", () => {
  it("keeps sensitive public/provisioning failures on the redacted logger", () => {
    for (const path of redactedLoggingSurfaces) {
      const source = readFileSync(path, "utf8");

      expect(source).toContain("logOperationalError");
      expect(source).not.toContain("console.error");
    }
  });
});
