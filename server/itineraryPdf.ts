import PDFDocument from "pdfkit";

export type ItineraryRow = {
  id: number;
  visitDate: Date;
  title: string;
  description: string | null;
  timeSlot: string | null;
  attractionName: string | null;
  sortIndex: number | null;
};

export type ItineraryPdfData = {
  ownerName: string | null;
  /** Grouped rows keyed by ISO date string (YYYY-MM-DD), in ascending date order. */
  days: { dateLabel: string; rows: ItineraryRow[] }[];
  totalItems: number;
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function thinLine(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(48, y).lineTo(547, y).lineWidth(0.6).strokeColor("#e7e5e4").stroke().lineWidth(1);
}

function goldLine(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(48, y).lineTo(547, y).lineWidth(1.2).strokeColor("#b8860b").stroke().lineWidth(1);
}

function emitDocument(doc: PDFKit.PDFDocument, data: ItineraryPdfData): void {
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
  doc.text("VISIT ITINERARY", 430, 30, { align: "right" });
  doc.fontSize(10).font("Helvetica");
  doc.fillColor("#e5e5e5").text("Personal visit plan", 430, 52, { align: "right" });

  // ---------- Owner line ----------
  doc.fillColor(ink).fontSize(13).font("Helvetica-Bold");
  doc.text("Prepared by", 48, 140);
  doc.font("Helvetica").fontSize(11);
  doc.text(data.ownerName ?? "A KNMP visitor", 48, 162);
  doc.fillColor(muted).fontSize(10);
  doc.text(
    `${data.totalItems} planned ${data.totalItems === 1 ? "activity" : "activities"} across ${data.days.length} visit ${data.days.length === 1 ? "day" : "days"}  ·  Issued ${new Date().toLocaleDateString("en-GB")}`,
    48,
    184,
  );

  // ---------- Days ----------
  let y = doc.y + 14;
  for (const day of data.days) {
    // Day header chip
    doc.rect(48, y, 499, 26).fill("#f5f0e4").strokeColor("#d6cbb0").lineWidth(0.8).stroke().lineWidth(1);
    doc.fillColor(green).fontSize(11).font("Helvetica-Bold");
    doc.text(day.dateLabel, 56, y + 8, { width: 400 });
    doc.fillColor(muted).fontSize(9).font("Helvetica");
    doc.text(`${day.rows.length} item${day.rows.length === 1 ? "" : "s"}`, 480, y + 9, { align: "right" });
    y += 34;

    for (const row of day.rows) {
      if (row.timeSlot) {
        doc.fillColor(gold).fontSize(10).font("Helvetica-Bold");
        doc.text(row.timeSlot, 56, y, { width: 70 });
      }
      const textX = row.timeSlot ? 130 : 56;
      doc.fillColor(ink).fontSize(11).font("Helvetica-Bold");
      doc.text(row.title, textX, y, { width: 464 });
      const lineY = doc.y + 3;
      if (row.attractionName) {
        doc.fillColor(muted).fontSize(9).font("Helvetica");
        doc.text(`Attraction: ${row.attractionName}`, textX, lineY, { width: 464 });
        y = doc.y + 5;
      } else {
        y = lineY + 5;
      }
      if (row.description) {
        doc.fillColor(ink).fontSize(10).font("Helvetica");
        doc.text(row.description, textX, y, { width: 464 });
        y = doc.y + 4;
      }
      y += 6;
    }
    thinLine(doc, y + 2);
    y += 16;

    // Overflow onto a fresh page if needed
    if (y > 700 && data.days.indexOf(day) < data.days.length - 1) {
      doc.addPage({ size: "A4", margin: 48 });
      y = 48;
    }
  }

  // ---------- Footer ----------
  const footerY = 740;
  goldLine(doc, footerY);
  doc.fillColor(muted).fontSize(9).font("Helvetica");
  doc.text(
    "This itinerary is a personal plan and does not reserve entry. Please bring your booking reference and confirm opening hours on the day of your visit. For enquiries visit the park office on Prof. Atta Mills High Street, Accra.",
    48,
    footerY + 10,
    { width: 499 },
  );
  doc.fillColor(green).font("Helvetica-Bold");
  doc.text("KNMP VisitHub · Kwame Nkrumah Memorial Park", 48, footerY + 42);
}

/** Render a visitor itinerary (grouped by visit date) into an A4 PDF and return its bytes. */
export function buildItineraryPdfBuffer(data: ItineraryPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    emitDocument(doc, data);
    doc.end();
  });
}

export { isoDate };
