import { buildTicketPdfBuffer, type TicketData } from "./ticketPdf";

/** Result of an attempt to send a booking confirmation email. */
export type TicketEmailResult = {
  sent: boolean;
  /** Reason the email was skipped or failed (empty when sent). */
  reason: string;
  /** Resend message id when sent. */
  messageId?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

const SENDER = "KNMP VisitHub <onboarding@resend.dev>";
const REPLY_TO = "onboarding@resend.dev";

function fghs(pesewas: number): string {
  return `GH\u20B5 ${(pesewas / 100).toFixed(2)}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Sends the booking confirmation email with the PDF ticket attached.
 * Returns a result instead of throwing so that a missing email address or a
 * temporary provider outage never blocks the booking itself.
 */
export async function sendBookingConfirmationEmail(data: {
  to: string;
  recipientName?: string | null;
  booking: { reference: string; visitDate: Date; visitEndDate?: Date | null; totalPesewas: number; totalVisitors?: number };
  ticketData: TicketData;
  slotLabels: Map<string, string> | null;
  siteBaseUrl?: string;
}): Promise<TicketEmailResult> {
  const { to, recipientName, booking, ticketData, slotLabels, siteBaseUrl } = data;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "Email service is not configured." };
  }
  const address = (to ?? "").trim();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { sent: false, reason: "No valid contact email address on the booking." };
  }

  const pdfBuffer = await buildTicketPdfBuffer(ticketData, slotLabels);

  const visitLabel = booking.visitEndDate
    ? `${fmtDate(booking.visitDate)} – ${fmtDate(booking.visitEndDate)}`
    : fmtDate(booking.visitDate);

  const greeting = recipientName ? recipientName.split(" ")[0] : "there";
  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Georgia,serif;color:#1c1917;background:#fafaf9;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#b8860b;text-transform:uppercase;">Kwame Nkrumah Memorial Park</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#14532d;">Your visit is booked, ${greeting}!</h1>
    <p style="margin:0 0 24px;line-height:1.6;">
      Your booking <strong style="color:#14532d;">${booking.reference}</strong> is confirmed for
      <strong>${visitLabel}</strong> with ${booking.totalVisitors ?? "?"} visitor(s).
      The total of <strong>${fghs(booking.totalPesewas)}</strong> is recorded against your reference.
    </p>
    <p style="margin:0 0 24px;line-height:1.6;">
      Please present the attached PDF ticket (or its reference code) at the park entrance for check-in.
      Keep it handy — it contains your booking details, visitor breakdown and guided-tour time slots.
    </p>
    ${
      siteBaseUrl
        ? `<p style="margin:0 0 24px;line-height:1.6;">You can also view and manage your bookings anytime at
      <a href="${siteBaseUrl}/my-bookings" style="color:#b8860b;">${siteBaseUrl}/my-bookings</a></p>`
        : ""
    }
    <p style="margin:0;border-top:1px solid #e7e5e4;padding-top:16px;font-size:13px;color:#78716c;">
      Kwame Nkrumah Memorial Park &amp; Mausoleum · High Street, Accra
    </p>
  </div>
</body>
</html>`;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      replyTo: REPLY_TO,
      to: [address],
      subject: `Your KNMP Visit Ticket — ${booking.reference}`,
      html,
      attachments: [
        {
          filename: `KNMP-ticket-${booking.reference}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const reason = `Email provider error (${response.status}): ${text.slice(0, 200)}`;
    // Log provider failures for the administrator to review; they are still
    // non-fatal so the booking itself is never blocked.
    console.warn("[Email] Booking confirmation send failed:", reason);
    return { sent: false, reason };
  }
  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, reason: "", messageId: json.id };
}
