import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { ItineraryEmailModel } from "@/lib/itinerary-email";
import {
  AffiliateSection,
  CtaButtons,
  DayPreview,
  EmailFooter,
  EmailHeader,
  FeedbackBlock,
  TripHero,
  TripSummary,
} from "@/emails/components";

export default function ItineraryReadyEmail(model: ItineraryEmailModel) {
  const summaryRows = [
    { label: "Destination", value: model.destination },
    { label: "Dates", value: model.dateRange },
    { label: "Number of Days", value: model.dayCountLabel },
    { label: "Travelers", value: model.travelers },
    { label: "Transportation", value: model.transportation },
    { label: "Accommodation", value: model.accommodation },
    { label: "Budget", value: model.budget },
    { label: "Dietary Preferences", value: model.dietary },
    { label: "Interests", value: model.interests },
  ];

  return (
    <Html>
      <Head />
      <Preview>Your {model.destination} family itinerary is ready.</Preview>
      <Body
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: "#f4f7f8",
          fontFamily:
            'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            border: "1px solid #dde5e8",
            overflow: "hidden",
          }}
        >
          <EmailHeader
            logoUrl={model.logoUrl}
            brandName={model.brandName}
            tagline={model.tagline}
          />

          <Section style={{ padding: "0 24px 8px" }}>
            <TripHero
              destination={model.destination}
              dateRange={model.dateRange}
              dayCountLabel={model.dayCountLabel}
            />

            {model.personalNote ? (
              <Text
                style={{
                  margin: "0 0 20px",
                  padding: "12px 14px",
                  backgroundColor: "#ffecec",
                  borderRadius: "12px",
                  fontSize: "14px",
                  color: "#1a2226",
                  lineHeight: "1.5",
                }}
              >
                {model.personalNote}
              </Text>
            ) : null}

            <Text style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#1a2226" }}>
              Hi!
            </Text>
            <Text style={{ margin: "0 0 8px", fontSize: "15px", color: "#1a2226", lineHeight: "1.55" }}>
              Your personalized family itinerary is ready.
            </Text>
            <Text style={{ margin: "0 0 24px", fontSize: "14px", color: "#5b6b73", lineHeight: "1.55" }}>
              We&apos;ve planned your trip based on your family&apos;s ages, travel style,
              transportation, accommodation, budget, dietary preferences, and interests.
            </Text>

            <TripSummary rows={summaryRows} />

            <DayPreview
              title={model.day1Title}
              stops={model.day1Stops}
              moreDaysNote={model.moreDaysNote}
            />

            <CtaButtons viewUrl={model.viewUrl} pdfUrl={model.pdfUrl} />

            <AffiliateSection tickets={model.affiliateTickets} />

            <FeedbackBlock feedbackUrl={model.feedbackUrl} />
          </Section>

          <EmailFooter brandName={model.brandName} tagline={model.tagline} />
        </Container>
      </Body>
    </Html>
  );
}
