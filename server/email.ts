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

/**
 * Shared Resend send with validation. A missing key, a missing/invalid
 * address, or a provider outage returns a result instead of throwing, so that
 * callers never block their own workflows on email delivery.
 */
async function sendResend(payload: { to: string[]; subject: string; html: string; attachments?: Array<{ filename: string; content: string }> }): Promise<TicketEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "Email service is not configured." };
  }
  const address = (payload.to[0] ?? "").trim();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { sent: false, reason: "No valid contact email address on the booking." };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      replyTo: REPLY_TO,
      ...payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const reason = `Email provider error (${response.status}): ${text.slice(0, 200)}`;
    // Log provider failures for the administrator to review; they are still
    // non-fatal so the calling workflow is never blocked.
    console.warn("[Email] Send failed:", reason);
    return { sent: false, reason };
  }
  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, reason: "", messageId: json.id };
}

/** Canonical status wording shown to visitors in emails and UI. */
export function bookingStatusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
    case "pending":
      return "Pending review";
    case "checked-in":
      return "Checked in";
    default:
      return status;
  }
}

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
      Please present the attached PDF ticket (or its QR code) at the park entrance for check-in.
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

  return sendResend({
    to: [to],
    subject: `Your KNMP Visit Ticket — ${booking.reference}`,
    html,
    attachments: [
      {
        filename: `KNMP-ticket-${booking.reference}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

/**
 * Notifies the visitor when an admin changes a booking's status (e.g. to
 * confirmed or cancelled). No attachment — the ticket PDF can always be
 * downloaded from the visitor's own bookings page.
 */
export async function sendBookingStatusEmail(data: {
  to: string;
  recipientName?: string | null;
  booking: { reference: string; visitDate: Date; visitEndDate?: Date | null; totalPesewas: number; totalVisitors?: number };
  previousStatus: string;
  newStatus: string;
  siteBaseUrl?: string;
}): Promise<TicketEmailResult> {
  const { to, recipientName, booking, previousStatus, newStatus, siteBaseUrl } = data;

  const isCancelled = newStatus === "cancelled";
  const visitLabel = booking.visitEndDate
    ? `${fmtDate(booking.visitDate)} – ${fmtDate(booking.visitEndDate)}`
    : fmtDate(booking.visitDate);

  const greeting = recipientName ? recipientName.split(" ")[0] : "there";
  const accentColor = isCancelled ? "#b91c1c" : "#14532d";
  const title = isCancelled ? `We are sorry, ${greeting} — your booking was cancelled` : `Your booking is ${newStatus}, ${greeting}!`;
  const body = isCancelled
    ? `Booking <strong style="color:${accentColor};">${booking.reference}</strong> for <strong>${visitLabel}</strong> (${booking.totalVisitors ?? "?"} visitor(s)) has been cancelled. The recorded amount of <strong>${fghs(booking.totalPesewas)}</strong> is no longer owed. You can book again at any time from the park's website.`
    : `Booking <strong style="color:${accentColor};">${booking.reference}</strong> for <strong>${visitLabel}</strong> (${booking.totalVisitors ?? "?"} visitor(s)) has been ${newStatus}. The total of <strong>${fghs(booking.totalPesewas)}</strong> is recorded against your reference.`;

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Georgia,serif;color:#1c1917;background:#fafaf9;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#b8860b;text-transform:uppercase;">Kwame Nkrumah Memorial Park</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:${accentColor};">${title}</h1>
    <p style="margin:0 0 16px;line-height:1.6;">${body}</p>
    <p style="margin:0 0 24px;line-height:1.6;">
      Status changed from <strong>${bookingStatusLabel(previousStatus)}</strong> to
      <strong>${bookingStatusLabel(newStatus)}</strong>. You can view your updated ticket
      on your <a href="${siteBaseUrl ?? ""}/my-bookings" style="color:#b8860b;">bookings page</a>, where you can
      download the PDF ticket with your check-in QR code.
    </p>
    <p style="margin:0;border-top:1px solid #e7e5e4;padding-top:16px;font-size:13px;color:#78716c;">
      Kwame Nkrumah Memorial Park &amp; Mausoleum · High Street, Accra
    </p>
  </div>
</body>
</html>`;

  return sendResend({
    to: [to],
    subject: `${isCancelled ? "Booking cancelled" : "Booking updated"} — ${booking.reference}`,
    html,
  });
}

/**
 * Confirms a visitor's guided-tour registration with their unique reference.
 * Fire-and-forget: returns a result instead of throwing so that a missing
 * email address or a temporary provider outage never blocks the registration.
 */
export function sendEventRegistrationEmail(data: {
  eventName: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  meetingPoint: string | null;
  reference: string;
  attendeeName: string;
  numberOfParticipants: number;
  feePesewas: number;
  recipientEmail: string | null;
}): void {
  const {
    eventName,
    eventDate,
    startTime,
    endTime,
    meetingPoint,
    reference,
    attendeeName,
    numberOfParticipants,
    feePesewas,
    recipientEmail,
  } = data;
  if (!recipientEmail) return;
  const timeLabel =
    startTime && endTime
      ? `${startTime} – ${endTime}`
      : startTime
        ? `from ${startTime}`
        : "";
  const greeting = attendeeName.split(" ")[0];
  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Georgia,serif;color:#1c1917;background:#fafaf9;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#b8860b;text-transform:uppercase;">Kwame Nkrumah Memorial Park</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#14532d;">Tour registered, ${greeting}!</h1>
    <p style="margin:0 0 16px;line-height:1.6;">
      You are registered for <strong style="color:#14532d;">${eventName}</strong> on
      <strong>${fmtDate(new Date(eventDate))}</strong>${timeLabel ? ` at <strong>${timeLabel}</strong>` : ""}.
      Your party size is <strong>${numberOfParticipants}</strong> and your
      registration reference is <strong style="color:#b8860b;">${reference}</strong>.
      ${meetingPoint ? `<br/>Please meet us at <strong>${meetingPoint}</strong>.` : ""}
      ${feePesewas > 0 ? `<br/>The fee of <strong>${fghs(feePesewas)}</strong> per participant is payable at the meeting point.` : "This tour is free of charge."}
    </p>
    <p style="margin:0 0 24px;line-height:1.6;">
      Please keep your reference handy and present it to the guide on the day.
      You can view or cancel your registrations from your account.
    </p>
    <p style="margin:0;border-top:1px solid #e7e5e4;padding-top:16px;font-size:13px;color:#78716c;">
      Kwame Nkrumah Memorial Park &amp; Mausoleum · High Street, Accra
    </p>
  </div>
</body>
</html>`;
  sendResend({
    to: [recipientEmail],
    subject: `Tour registered — ${reference}`,
    html,
  }).then(result => {
    if (!result.sent) {
      console.warn("[Email] Event registration email skipped:", result.reason);
    }
  });
}
