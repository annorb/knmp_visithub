import { describe, it, expect } from "vitest";

describe("RESEND_API_KEY", () => {
  it("is configured and can authenticate against the Resend API", async () => {
    const key = process.env.RESEND_API_KEY;
    expect(key).toBeTruthy();
    expect(key!.length).toBeGreaterThan(20);
    const response = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${key}` },
    });
    // 200 = valid key and list visible; 401/403 = invalid key
    expect(response.status).toBeLessThan(401);
    const body = await response.json();
    expect(body).toHaveProperty("data");
  });
});
