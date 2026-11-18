import { describe, expect, it } from "vitest";
import { HttpApiError, errorMessage } from "../src/errors";

class VendorError extends HttpApiError {
  constructor(status: number, path: string, body: string) {
    super("Vendor", status, path, body);
    this.name = "VendorError";
  }

  protected override describe(status: number, path: string, body: string): string {
    if (status === 401) return "Vendor rejected the login.";
    return super.describe(status, path, body);
  }
}

describe("HttpApiError", () => {
  it("writes the base messages for 404, 429 and the fallback from the vendor", () => {
    expect(new HttpApiError("Vendor", 404, "/x", "").message).toBe("Not found: /x");
    expect(new HttpApiError("Vendor", 429, "/x", "").message).toBe("Vendor rate limit. Try again in a minute.");
    expect(new HttpApiError("Vendor", 500, "/x", "  oops  ").message).toBe("Vendor error 500 on /x: oops");
    expect(new HttpApiError("Vendor", 500, "/x", "").message).toBe("Vendor error 500 on /x");
    expect(new HttpApiError("Vendor", 502, "/x", "a".repeat(300)).message).toBe(`Vendor error 502 on /x: ${"a".repeat(200)}`);
  });

  it("keeps status, path and body", () => {
    const e = new HttpApiError("Vendor", 500, "/x", "body");
    expect([e.status, e.path, e.body, e.name]).toEqual([500, "/x", "body", "HttpApiError"]);
    expect(e).toBeInstanceOf(Error);
  });

  it("flags 404 as isNotFound and 429 as isRateLimit", () => {
    expect(new HttpApiError("Vendor", 404, "/x", "").isNotFound).toBe(true);
    expect(new HttpApiError("Vendor", 404, "/x", "").isRateLimit).toBe(false);
    expect(new HttpApiError("Vendor", 429, "/x", "").isRateLimit).toBe(true);
    expect(new HttpApiError("Vendor", 429, "/x", "").isNotFound).toBe(false);
    expect(new HttpApiError("Vendor", 500, "/x", "").isNotFound).toBe(false);
  });

  it("lets a subclass write its own message and fall back to the base", () => {
    const e = new VendorError(401, "/x", "");
    expect(e.message).toBe("Vendor rejected the login.");
    expect(e).toBeInstanceOf(HttpApiError);
    expect(e.name).toBe("VendorError");
    expect(new VendorError(404, "/y", "").message).toBe("Not found: /y");
  });
});

describe("errorMessage", () => {
  it("reads an Error's message and turns anything else into a string", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("text")).toBe("text");
    expect(errorMessage(42)).toBe("42");
  });
});
