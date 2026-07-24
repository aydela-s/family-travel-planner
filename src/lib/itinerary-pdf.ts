import { jsPDF } from "jspdf";
import {
  buildCoverContent,
  itineraryPdfFilename,
  type ItineraryExportContext,
} from "@/lib/itinerary-export";
import { formatMoney, formatTime12h, oneLineNote } from "@/lib/format";

const MARGIN = 54;
const PAGE_BOTTOM = 760;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return MARGIN;
}

/**
 * Build a multi-page PDF: cover on page 1, itinerary from page 2.
 * Call only in the browser (jspdf).
 */
export function buildItineraryPdf(ctx: ItineraryExportContext): {
  blob: Blob;
  filename: string;
} {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const cover = buildCoverContent(ctx);
  const { itinerary } = ctx;

  // —— Cover page ——
  let y = 220;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(1, 109, 118);
  const title = cover.destination;
  doc.text(title, pageWidth / 2, y, { align: "center" });

  y += 36;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(55, 65, 70);
  doc.text(cover.dateRange, pageWidth / 2, y, { align: "center" });

  y += 48;
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  for (const line of cover.familyLines) {
    const isHeading = line === "Family:";
    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += isHeading ? 22 : 20;
  }

  y = Math.max(y + 40, 640);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(1, 109, 118);
  doc.text(cover.generatedBy, pageWidth / 2, y, { align: "center" });

  // —— Itinerary pages ——
  doc.addPage();
  y = MARGIN;
  const maxWidth = pageWidth - MARGIN * 2;

  for (const day of itinerary.days) {
    y = ensureSpace(doc, y, 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(1, 109, 118);
    doc.text(`Day ${day.day}`, MARGIN, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(day.formattedDate, MARGIN, y);
    y += 22;

    for (const a of day.activities) {
      const time = a.endTime
        ? `${formatTime12h(a.time)} – ${formatTime12h(a.endTime)}`
        : formatTime12h(a.time);
      const titleLines = doc.splitTextToSize(a.title, maxWidth - 10);
      const needed = 16 + titleLines.length * 14 + (a.location ? 14 : 0) + (a.notes ? 14 : 0) + 8;
      y = ensureSpace(doc, y, needed);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(time, MARGIN, y);
      y += 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(titleLines, MARGIN + 8, y);
      y += titleLines.length * 13;

      if (a.location?.name) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(a.location.name, MARGIN + 8, y);
        y += 12;
      }
      if (a.notes) {
        const note = oneLineNote(a.notes, 140);
        const noteLines = doc.splitTextToSize(note, maxWidth - 16);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(noteLines, MARGIN + 8, y);
        y += noteLines.length * 11;
      }
      y += 10;
    }

    const c = day.costBreakdown;
    y = ensureSpace(doc, y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(1, 109, 118);
    doc.text(
      `Daily total: ${formatMoney(c.total, c.currency, itinerary.currencySymbol)}`,
      MARGIN,
      y,
    );
    y += 28;
  }

  const tripTotal = itinerary.days.reduce((s, d) => s + d.costs.total, 0);
  y = ensureSpace(doc, y, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(1, 109, 118);
  doc.text(
    `Estimated trip total: ${formatMoney(tripTotal, itinerary.currency, itinerary.currencySymbol)}`,
    MARGIN,
    y,
  );

  const blob = doc.output("blob");
  return { blob, filename: itineraryPdfFilename(itinerary) };
}

export function downloadItineraryPdf(ctx: ItineraryExportContext): void {
  const { blob, filename } = buildItineraryPdf(ctx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
