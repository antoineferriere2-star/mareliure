import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSitePublicHtml, normalizeOnboardingUrl } from "./safeFetch.server";

describe("normalizeOnboardingUrl", () => {
  it("accepts ordinary public http(s) URLs", () => {
    expect(() => normalizeOnboardingUrl("https://sanibeldecks.com")).not.toThrow();
    expect(() => normalizeOnboardingUrl("http://example.com/path")).not.toThrow();
  });

  it("accepts a public IPv4 literal", () => {
    expect(() => normalizeOnboardingUrl("http://8.8.8.8")).not.toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => normalizeOnboardingUrl("not a url")).toThrow("Invalid URL.");
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => normalizeOnboardingUrl("ftp://example.com")).toThrow(
      "Only http/https URLs are accepted.",
    );
    expect(() => normalizeOnboardingUrl("javascript:alert(1)")).toThrow(
      "Only http/https URLs are accepted.",
    );
    expect(() => normalizeOnboardingUrl("file:///etc/passwd")).toThrow(
      "Only http/https URLs are accepted.",
    );
  });

  it("rejects localhost and internal TLDs", () => {
    expect(() => normalizeOnboardingUrl("http://localhost")).toThrow(
      "This URL points to a disallowed address.",
    );
    expect(() => normalizeOnboardingUrl("http://foo.local")).toThrow(
      "This URL points to a disallowed address.",
    );
    expect(() => normalizeOnboardingUrl("http://foo.internal")).toThrow(
      "This URL points to a disallowed address.",
    );
  });

  it("rejects private, loopback and link-local IPv4 ranges", () => {
    expect(() => normalizeOnboardingUrl("http://127.0.0.1")).toThrow();
    expect(() => normalizeOnboardingUrl("http://10.0.0.5")).toThrow();
    expect(() => normalizeOnboardingUrl("http://172.16.0.1")).toThrow();
    expect(() => normalizeOnboardingUrl("http://172.31.255.255")).toThrow();
    expect(() => normalizeOnboardingUrl("http://192.168.1.1")).toThrow();
    expect(() => normalizeOnboardingUrl("http://169.254.169.254")).toThrow(); // cloud metadata
    expect(() => normalizeOnboardingUrl("http://0.0.0.0")).toThrow();
  });

  it("does not block IPv4 addresses just outside the 172.16.0.0/12 range", () => {
    expect(() => normalizeOnboardingUrl("http://172.15.255.255")).not.toThrow();
    expect(() => normalizeOnboardingUrl("http://172.32.0.1")).not.toThrow();
  });

  it("rejects private/loopback IPv6 literals, including IPv4-mapped ones", () => {
    expect(() => normalizeOnboardingUrl("http://[::1]")).toThrow();
    expect(() => normalizeOnboardingUrl("http://[fe80::1]")).toThrow();
    expect(() => normalizeOnboardingUrl("http://[fd00::1]")).toThrow();
    expect(() => normalizeOnboardingUrl("http://[::ffff:127.0.0.1]")).toThrow();
  });

  it("canonicalizes alternate IPv4 encodings before checking (decimal/hex bypass)", () => {
    // 2130706433 and 0x7f000001 both denote 127.0.0.1; the WHATWG URL parser
    // canonicalizes these to dotted-quad before .hostname is read.
    expect(() => normalizeOnboardingUrl("http://2130706433")).toThrow();
    expect(() => normalizeOnboardingUrl("http://0x7f000001")).toThrow();
  });
});

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSitePublicHtml", () => {
  it("fetches and returns the HTML of a public URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSitePublicHtml("https://sanibeldecks.com");
    expect(result.html).toContain("Hello");
    expect(result.finalUrl).toBe("https://sanibeldecks.com/");
  });

  it("follows a redirect to another public URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://sanibeldecks.com/home" } }),
      )
      .mockResolvedValueOnce(
        new Response("<html>Home</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSitePublicHtml("https://sanibeldecks.com");
    expect(result.finalUrl).toBe("https://sanibeldecks.com/home");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a redirect pointing to a private address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSitePublicHtml("https://sanibeldecks.com")).rejects.toThrow();
  });

  it("rejects too many redirects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "https://sanibeldecks.com/loop" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSitePublicHtml("https://sanibeldecks.com")).rejects.toThrow(
      "Too many redirects.",
    );
  });

  it("rejects non-HTML content types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSitePublicHtml("https://sanibeldecks.com")).rejects.toThrow(
      "This URL did not return an HTML page.",
    );
  });

  it("caps the response body at the size limit", async () => {
    const chunk = new TextEncoder().encode("a".repeat(1_000_000));
    const stream = streamFromChunks([chunk, chunk, chunk]); // 3MB total, cap is 2MB
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(stream, { status: 200, headers: { "content-type": "text/html" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSitePublicHtml("https://sanibeldecks.com");
    expect(result.html.length).toBe(2 * 1024 * 1024);
  });
});
