import { Img, Link, Section, Text } from "@react-email/components";
import * as React from "react";

const PRIMARY = "#016d76";
const MUTED = "#5b6b73";

export function EmailHeader({
  logoUrl,
  brandName,
  tagline,
}: {
  logoUrl: string;
  brandName: string;
  tagline: string;
}) {
  return (
    <Section style={{ padding: "28px 24px 16px", textAlign: "center" as const }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Img
        src={logoUrl}
        alt={brandName}
        width="180"
        style={{ margin: "0 auto 12px", display: "block" }}
      />
      <Text style={{ margin: 0, fontSize: "14px", color: MUTED, lineHeight: "1.5" }}>
        {tagline}
      </Text>
    </Section>
  );
}

export function TripHero({
  destination,
  dateRange,
  dayCountLabel,
}: {
  destination: string;
  dateRange: string;
  dayCountLabel: string;
}) {
  return (
    <Section
      style={{
        backgroundColor: "#e6f3f4",
        borderRadius: "16px",
        padding: "28px 24px",
        textAlign: "center" as const,
        margin: "8px 0 24px",
      }}
    >
      <Text
        style={{
          margin: "0 0 8px",
          fontSize: "28px",
          fontWeight: 700,
          color: PRIMARY,
          lineHeight: "1.25",
        }}
      >
        🌍 {destination}
      </Text>
      <Text style={{ margin: "0 0 6px", fontSize: "16px", color: "#2a3439" }}>{dateRange}</Text>
      <Text style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: PRIMARY }}>
        {dayCountLabel}
      </Text>
    </Section>
  );
}

export function TripSummary({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <Section
      style={{
        border: "1px solid #dde5e8",
        borderRadius: "16px",
        padding: "8px 20px 12px",
        margin: "0 0 24px",
        backgroundColor: "#ffffff",
      }}
    >
      <Text
        style={{
          margin: "12px 0 8px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: PRIMARY,
        }}
      >
        Trip summary
      </Text>
      {rows.map((row) => (
        <Section
          key={row.label}
          style={{
            borderTop: "1px solid #eef2f4",
            padding: "10px 0",
          }}
        >
          <Text style={{ margin: "0 0 2px", fontSize: "12px", color: MUTED }}>{row.label}</Text>
          <Text style={{ margin: 0, fontSize: "14px", color: "#1a2226", fontWeight: 600 }}>
            {row.value}
          </Text>
        </Section>
      ))}
    </Section>
  );
}

export function DayPreview({
  title,
  stops,
  moreDaysNote,
}: {
  title: string;
  stops: { label: string; title: string }[];
  moreDaysNote: string | null;
}) {
  return (
    <Section style={{ margin: "0 0 28px" }}>
      <Text
        style={{
          margin: "0 0 12px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: PRIMARY,
        }}
      >
        Trip preview
      </Text>
      <Section
        style={{
          border: "1px solid #dde5e8",
          borderRadius: "16px",
          padding: "16px 20px",
          backgroundColor: "#fafbfb",
        }}
      >
        <Text style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#1a2226" }}>
          {title}
        </Text>
        {stops.map((stop, i) => (
          <Section key={`${stop.label}-${i}`} style={{ marginBottom: "10px" }}>
            <Text style={{ margin: 0, fontSize: "12px", color: MUTED, fontWeight: 600 }}>
              {stop.label}
            </Text>
            <Text style={{ margin: "2px 0 0", fontSize: "14px", color: "#1a2226" }}>
              {stop.title}
            </Text>
          </Section>
        ))}
        {moreDaysNote && (
          <Text style={{ margin: "12px 0 0", fontSize: "13px", color: MUTED, fontStyle: "italic" }}>
            {moreDaysNote}
          </Text>
        )}
      </Section>
    </Section>
  );
}

function CtaButton({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? {
          backgroundColor: "#ff5757",
          color: "#ffffff",
          border: "1px solid #ff5757",
        }
      : variant === "secondary"
        ? {
            backgroundColor: PRIMARY,
            color: "#ffffff",
            border: `1px solid ${PRIMARY}`,
          }
        : {
            backgroundColor: "#ffffff",
            color: PRIMARY,
            border: `1px solid ${PRIMARY}`,
          };

  return (
    <Section style={{ textAlign: "center" as const, margin: "0 0 12px" }}>
      <Link
        href={href}
        style={{
          display: "inline-block",
          padding: "14px 28px",
          borderRadius: "14px",
          fontSize: "15px",
          fontWeight: 700,
          textDecoration: "none",
          ...styles,
        }}
      >
        {label}
      </Link>
    </Section>
  );
}

export function CtaButtons({
  viewUrl,
  pdfUrl,
}: {
  viewUrl: string;
  pdfUrl?: string;
}) {
  return (
    <Section style={{ margin: "8px 0 28px" }}>
      <CtaButton href={viewUrl} label="View Full Itinerary" variant="primary" />
      {pdfUrl ? (
        <CtaButton href={pdfUrl} label="Download PDF" variant="secondary" />
      ) : null}
    </Section>
  );
}

export function AffiliateSection({
  tickets,
}: {
  tickets: { label: string; url: string }[];
}) {
  if (tickets.length === 0) return null;
  return (
    <Section style={{ margin: "0 0 28px" }}>
      <Text
        style={{
          margin: "0 0 12px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color: PRIMARY,
        }}
      >
        Popular tickets
      </Text>
      <Section
        style={{
          border: "1px solid #dde5e8",
          borderRadius: "16px",
          padding: "12px 20px",
          backgroundColor: "#ffffff",
        }}
      >
        {tickets.map((t) => (
          <Text key={t.url} style={{ margin: "8px 0" }}>
            <Link href={t.url} style={{ color: PRIMARY, fontSize: "14px", fontWeight: 600 }}>
              🎟 {t.label}
            </Link>
          </Text>
        ))}
      </Section>
    </Section>
  );
}

export function FeedbackBlock({ feedbackUrl }: { feedbackUrl: string }) {
  return (
    <Section
      style={{
        textAlign: "center" as const,
        margin: "0 0 28px",
        padding: "20px",
        backgroundColor: "#e6f3f4",
        borderRadius: "16px",
      }}
    >
      <Text style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#1a2226" }}>
        How did we do?
      </Text>
      <Text style={{ margin: "0 0 12px", fontSize: "18px", letterSpacing: "2px" }}>⭐⭐⭐⭐⭐</Text>
      <Link
        href={feedbackUrl}
        style={{
          display: "inline-block",
          padding: "12px 22px",
          borderRadius: "14px",
          backgroundColor: "#ffffff",
          color: PRIMARY,
          border: `1px solid ${PRIMARY}`,
          fontSize: "14px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Send Feedback
      </Link>
    </Section>
  );
}

export function EmailFooter({ brandName, tagline }: { brandName: string; tagline: string }) {
  return (
    <Section style={{ textAlign: "center" as const, padding: "8px 24px 32px" }}>
      <Text style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "#1a2226" }}>
        Have an amazing trip!
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: "14px", color: PRIMARY, fontWeight: 700 }}>
        The {brandName} Team
      </Text>
      <Text style={{ margin: 0, fontSize: "12px", color: MUTED }}>{tagline}</Text>
    </Section>
  );
}
