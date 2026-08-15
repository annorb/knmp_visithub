import { describe, it, expect, vi } from "vitest";
import { sendBookingConfirmationEmail } from "./email";
import { buildTicketPdfBuffer } from "./ticketPdf";
import { getCategoryBreakdownCsv, getDailyVisitorForecast } from "./db";

function minimalTicketData() {
  return {
    reference: "KNMP-999999",
    visitorName: "Test Visitor",
    contactEmail: "visitor@example.com",
    contactPhone: null,
    visitDate: new Date("2026-08-20T00:00:00.000Z"),
    visitEndDate: null,
    totalPesewas: 2500,
    totalVisitors: 2,
    status: "confirmed",
    items: [
      {
        categoryName: "Adults",
        quantity: 2,
        unitPricePesewas: 1000,
        subtotalPesewas: 2000,
      },
    ],
    slots: [],
  };
}

describe("email helper (sendBookingConfirmationEmail)", () => {
  it("skips sending when no contact email is provided", async () => {
    const result = await sendBookingConfirmationEmail({
      to: "",
      recipientName: "Test",
      booking: {
        reference: "KNMP-999999",
        visitDate: new Date("2026-08-20T00:00:00.000Z"),
        totalPesewas: 2500,
      },
      ticketData: minimalTicketData(),
      slotLabels: null,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("No valid contact email");
  });

  it("sends the email with the PDF ticket attached via Resend", async () => {
    const pdfBuffer = await buildTicketPdfBuffer(minimalTicketData(), null);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "msg_abc123" }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBookingConfirmationEmail({
      to: "visitor@example.com",
      recipientName: "Test Visitor",
      booking: {
        reference: "KNMP-999999",
        visitDate: new Date("2026-08-20T00:00:00.000Z"),
        totalPesewas: 2500,
        totalVisitors: 2,
      },
      ticketData: minimalTicketData(),
      slotLabels: null,
    });

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("msg_abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["visitor@example.com"]);
    expect(body.subject).toContain("KNMP-999999");
    expect(body.attachments[0].filename).toBe("KNMP-ticket-KNMP-999999.pdf");
    expect(body.attachments[0].content.length).toBeGreaterThan(1000);
    expect(body.html).toContain("KNMP-999999");
    vi.unstubAllGlobals();
  });

  it("reports a provider error without throwing", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "invalid_api_key",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBookingConfirmationEmail({
      to: "visitor@example.com",
      booking: {
        reference: "KNMP-999999",
        visitDate: new Date("2026-08-20T00:00:00.000Z"),
        totalPesewas: 2500,
      },
      ticketData: minimalTicketData(),
      slotLabels: null,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("401");
    vi.unstubAllGlobals();
  });
});

describe("category breakdown CSV", () => {
  it("emits a CSV header and one row per category", async () => {
    const csv = await getCategoryBreakdownCsv();
    expect(typeof csv).toBe("string");
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("category_id,category_name,visitors,revenue_ghs");
    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      expect(parts.length).toBeGreaterThanOrEqual(4);
      expect(Number(parts[parts.length - 2])).not.toBeNaN();
    }
  });

  it("respects an applied date range", async () => {
    const futureOnly = await getCategoryBreakdownCsv({
      from: new Date("2099-01-01T00:00:00.000Z"),
      to: new Date("2099-12-31T00:00:00.000Z"),
    });
    const lines = futureOnly.trim().split("\r\n");
    for (const line of lines.slice(1)) {
      expect(Number(line.split(",").slice(-2)[0])).toBe(0);
    }
  });
});

describe("daily visitor forecast", () => {
  it("returns exactly `days` rows covering today through today + days - 1", async () => {
    const rows = await getDailyVisitorForecast(14);
    expect(rows).toHaveLength(14);
    const today = new Date().toISOString().slice(0, 10);
    expect(rows[0].date).toBe(today);
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.visitors).toBeGreaterThanOrEqual(0);
      expect(row.bookings).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(row.bookings)).toBe(true);
    }
  });

  it("caps the day count at a sane maximum", async () => {
    const rows = await getDailyVisitorForecast(999);
    expect(rows.length).toBeLessThanOrEqual(90);
  });
});

