import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type TicketData = {
  reference: string;
  visitorName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  visitDate: Date;
  visitEndDate: Date | null;
  totalPesewas: number;
  totalVisitors: number;
  status: string;
  items: { categoryName: string; quantity: number; unitPricePesewas: number; subtotalPesewas: number }[];
  slots: {
    attractionId?: number | null;
    attractionName: string | null;
    label?: string | null;
    startTime: string;
    endTime: string;
    visitDate?: Date;
  }[];
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function fmtGhs(pesewas: number): string {
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

/** Key: "${attractionId}-${startTime}" → display label. */
function resolveSlotLabel(
  s: { attractionId?: number | null; startTime: string; endTime: string; label?: string | null },
  slotLabels: Map<string, string> | null,
): string {
  if (s.label) return s.label;
  if (s.attractionId != null) {
    const l = slotLabels?.get(`${s.attractionId}-${s.startTime}`);
    if (l) return l;
  }
  return `${s.startTime} – ${s.endTime}`;
}

function thinLine(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(48, y).lineTo(547, y).lineWidth(0.6).strokeColor("#e7e5e4").stroke().lineWidth(1);
}

function goldLine(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(48, y).lineTo(547, y).lineWidth(1.2).strokeColor("#b8860b").stroke().lineWidth(1);
}

async function emitDocument(
  doc: PDFKit.PDFDocument,
  data: TicketData,
  slotLabels: Map<string, string> | null,
): Promise<void> {
  const green = "#14532d";
  const gold = "#b8860b";
  const ink = "#1c1917";
  const muted = "#78716c";

  // ---------- Header band ----------
  doc.rect(0, 0, 595, 110).fill(green);
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold");
  doc.text("KNMP VisitHub", 48, 30);
  doc.fontSize(9).font("Helvetica");
  doc.text("KWAME NKRUMAH MEMORIAL PARK & MAUSOLEUM · ACCRA, GHANA", 48, 62, { width: 400 });
  doc.fillColor("#f3d88b").fontSize(11).font("Helvetica-Bold");
  doc.text("ENTRY TICKET", 430, 30, { align: "right" });
  doc.fontSize(10).font("Helvetica");
  doc.fillColor("#e5e5e5").text("Admit one party", 430, 52, { align: "right" });
  doc.moveDown(2);

  // ---------- Reference ----------
  doc.fillColor(ink).fontSize(13).font("Helvetica-Bold");
  doc.text("Booking Reference", 48, 140);
  doc.fontSize(30).font("Courier-Bold");
  doc.fillColor(green).text(data.reference, 48, 162);
  doc.fontSize(10).font("Helvetica").fillColor(muted);
  doc.text(
    `Status: ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}  ·  Issued: ${fmtDate(new Date())}`,
    48,
    208,
  );

  // ---------- QR code for gate check-in ----------
  // Encodes the unique booking reference so gate staff can scan and verify it
  // against the booking record instead of typing the reference manually.
  const qrPayload = `KNMP-TICKET:${data.reference}`;
  try {
    const qrPng = await QRCode.toBuffer(qrPayload, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 1,
      color: { dark: green, light: "#ffffff" },
      width: 150,
    });
    doc.image(qrPng, 430, 135, { fit: [115, 115] });
    doc.fillColor(muted).fontSize(8).font("Helvetica");
    doc.text("Scan at park entrance", 430, 255, { width: 115, align: "center" });
  } catch (error) {
    console.warn("[Ticket] QR code generation failed; ticket still issued:", error);
  }

  // ---------- Visit block ----------
  doc.fillColor(ink).fontSize(13).font("Helvetica-Bold");
  doc.text("Visit Details", 48, 245);
  doc.font("Helvetica").fontSize(11);
  const visitLabel =
    data.visitEndDate && data.visitEndDate.getTime() !== data.visitDate.getTime()
      ? `From ${fmtDate(data.visitDate)} to ${fmtDate(data.visitEndDate)} (multi-day visit)`
      : `${fmtDate(data.visitDate)} (single day)`;
  doc.text(visitLabel, 48, 268, { width: 499 });
  doc.fillColor(muted).fontSize(10);
  const details = [
    data.visitorName ? `Primary visitor: ${data.visitorName}` : null,
    data.contactEmail
      ? `Contact: ${data.contactEmail}${data.contactPhone ? ` · ${data.contactPhone}` : ""}`
      : null,
    `Total party size: ${data.totalVisitors} visitors`,
  ].filter(Boolean);
  for (const line of details) {
    doc.text(line as string, 48, doc.y + 2);
  }

  // ---------- Line items table ----------
  let tableY = doc.y + 18;
  doc.fillColor(ink).fontSize(13).font("Helvetica-Bold");
  doc.text("Entrance Fees", 48, tableY);
  tableY = doc.y + 12;

  const colX = [48, 300, 390, 497];
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
  doc.rect(48, tableY, 499, 22).fill(green);
  doc.text("Category", 56, tableY + 7);
  doc.text("Qty", colX[1], tableY + 7);
  doc.text("Unit Price", colX[2], tableY + 7);
  doc.text("Subtotal", colX[3], tableY + 7, { align: "right" });
  tableY += 26;

  doc.font("Helvetica").fontSize(10).fillColor(ink);
  for (const item of data.items) {
    doc.text(item.categoryName, 56, tableY, { width: colX[1] - 64 });
    doc.text(String(item.quantity), colX[1], tableY, { width: colX[2] - colX[1] - 8 });
    doc.text(fmtGhs(item.unitPricePesewas), colX[2], tableY, { width: colX[3] - colX[2] - 8 });
    doc.text(fmtGhs(item.subtotalPesewas), colX[3], tableY, { align: "right" });
    tableY += 18;
  }
  thinLine(doc, tableY + 2);
  tableY += 12;
  doc.font("Helvetica-Bold").fontSize(12);
  doc.text("Total Paid", 56, tableY);
  doc.fillColor(green).text(fmtGhs(data.totalPesewas), colX[3], tableY, { align: "right" });
  tableY += 28;

  // ---------- Guided tour slots ----------
  if (data.slots.length > 0) {
    doc.fillColor(ink).fontSize(13).font("Helvetica-Bold");
    doc.text("Guided Tour Time Slots", 48, tableY);
    tableY = doc.y + 12;
    doc.font("Helvetica").fontSize(10);
    doc.fillColor(ink);
    for (const s of data.slots) {
      doc.text(
        `• ${s.attractionName ?? "Park guided tour"} — ${resolveSlotLabel(s, slotLabels)}`,
        56,
        tableY,
        { width: 491 },
      );
      tableY = doc.y + 4;
    }
    tableY += 8;
  }

  // ---------- Footer ----------
  const footerY = 740;
  goldLine(doc, footerY);
  doc.fillColor(muted).fontSize(9).font("Helvetica");
  doc.text(
    "Present this ticket (printed or on screen) with a valid ID at the park entrance. Ticket is valid only for the date(s) shown. For enquiries visit the park office on Prof. Atta Mills High Street, Accra.",
    48,
    footerY + 10,
    { width: 499 },
  );
  doc.fillColor(green).font("Helvetica-Bold");
  doc.text("KNMP VisitHub · Kwame Nkrumah Memorial Park", 48, footerY + 42);
}

/** Render a booking into an A4 PDF ticket and return its bytes. */
export function buildTicketPdfBuffer(
  data: TicketData,
  slotLabels: Map<string, string> | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    emitDocument(doc, data, slotLabels);
    doc.end();
  });
}
