import { jsPDF } from "jspdf";
import {
  buildCoverContent,
  formatCompactActivityLines,
  itineraryPdfFilename,
  type ItineraryExportContext,
} from "@/lib/itinerary-export";
import { formatMoney } from "@/lib/format";

const MARGIN = 54;
const PAGE_BOTTOM = 760;

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return MARGIN;
}

function moneyWhole(amount: number, symbol: string): string {
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

/**
 * Build a multi-page PDF: cover on page 1, itinerary from page 2.
 * Compact day-card layout with every activity expanded (same info as the UI).
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
  const symbol = itinerary.currencySymbol;

  // —— Cover page ——
  let y = 220;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(1, 109, 118);
  doc.text(cover.destination, pageWidth / 2, y, { align: "center" });

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
    const c = day.costBreakdown;
    const dayTitle = `Day ${day.day} · ${day.formattedDate}`;
    const dayTotal = moneyWhole(c.total, symbol);

    y = ensureSpace(doc, y, 56);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(1, 109, 118);
    doc.text(dayTitle, MARGIN, y);
    doc.text(dayTotal, pageWidth - MARGIN, y, { align: "right" });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `Food ${moneyWhole(c.food, symbol)}   Transport ${moneyWhole(c.transport, symbol)}   Activities ${moneyWhole(c.activities, symbol)}`,
      MARGIN,
      y,
    );
    y += 20;

    for (const a of day.activities) {
      // Helvetica lacks emoji/★ — use ASCII-safe summary for PDF glyphs.
      const { summary, details } = formatCompactActivityLines(a, symbol, {
        asciiStar: true,
      });
      const summarySafe = summary
        .replace(/🍽️|🎯|☕|😴|🚶/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const summaryLines = doc.splitTextToSize(summarySafe, maxWidth);
      const detailBlocks = details.map((d) => {
        const safe = d.replace(/^Maps:\s*/i, "").trim();
        return doc.splitTextToSize(
          d.startsWith("Maps:") ? `Maps: ${safe}` : safe,
          maxWidth - 12,
        );
      });
      const detailHeight = detailBlocks.reduce((h, lines) => h + lines.length * 11, 0);
      const needed = summaryLines.length * 13 + detailHeight + 14;
      y = ensureSpace(doc, y, needed);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(summaryLines, MARGIN, y);
      y += summaryLines.length * 12;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      for (const lines of detailBlocks) {
        doc.text(lines, MARGIN + 10, y);
        y += lines.length * 11;
      }
      y += 10;
    }

    y += 8;
  }

  const tripTotal = itinerary.days.reduce((s, d) => s + d.costs.total, 0);
  y = ensureSpace(doc, y, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(1, 109, 118);
  doc.text(
    `Estimated trip total: ${formatMoney(tripTotal, itinerary.currency, symbol)}`,
    MARGIN,
    y,
  );

  const blob = doc.output("blob");
  return { blob, filename: itineraryPdfFilename(itinerary) };
}

export async function downloadItineraryPdf(ctx: ItineraryExportContext): Promise<void> {
  const { blob, filename } = buildItineraryPdf(ctx);
  const file = new File([blob], filename, { type: "application/pdf" });

  // Phones (esp. iOS Safari) often ignore <a download> for blob URLs.
  // Prefer the native share sheet so the user can Save to Files / Drive.
  const canShareFile =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return;
    } catch (err) {
      // User cancelled — don't fall through to a broken download attempt.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const isIos =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  if (isIos) {
    // Opens the PDF; user can use Share → Save to Files.
    const opened = window.open(url, "_blank");
    if (!opened) {
      window.location.assign(url);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke — some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
