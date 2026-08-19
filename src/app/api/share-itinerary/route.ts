import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { Resend } from "resend";
import ItineraryReadyEmail from "@/emails/ItineraryReadyEmail";
import { buildItineraryEmailModel } from "@/lib/itinerary-email";
import { formatItineraryPlainText, isValidShareEmail } from "@/lib/itinerary-export";
import { saveItineraryShare } from "@/lib/itinerary-share-store";
import {
  feedbackPath,
  linkOrigin,
  sharedTripViewPath,
} from "@/lib/public-urls";
import { BRAND } from "@/config/brand";
import { Itinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

type ShareBody = {
  to?: string;
  message?: string;
  itinerary?: Itinerary;
  plan?: TripPlan;
  appOrigin?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ShareBody;
    const to = body.to?.trim() ?? "";
    if (!isValidShareEmail(to)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!body.itinerary?.days?.length) {
      return NextResponse.json({ error: "Missing itinerary to share." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.FEEDBACK_FROM_EMAIL?.trim() || `${BRAND.name} <onboarding@resend.dev>`;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Email sharing is not configured on this server yet." },
        { status: 503 },
      );
    }

    const requestOrigin = new URL(request.url).origin;
    const origin = linkOrigin(
      body.appOrigin || process.env.NEXT_PUBLIC_APP_URL || requestOrigin,
    );

    const saved = await saveItineraryShare({
      itinerary: body.itinerary,
      plan: body.plan ?? null,
    });

    const model = buildItineraryEmailModel({
      itinerary: body.itinerary,
      plan: body.plan,
      appOrigin: origin,
      personalNote: body.message,
      shareId: saved.id,
    });

    // Ensure CTAs point at persisted share + dedicated feedback page.
    model.viewUrl = `${origin}${sharedTripViewPath(saved.id)}`;
    model.feedbackUrl = `${origin}${feedbackPath()}`;

    const html = await render(ItineraryReadyEmail(model));
    const text = formatItineraryPlainText({
      itinerary: body.itinerary,
      plan: body.plan
        ? {
            adults: body.plan.adults,
            children: body.plan.children,
            startDate: body.plan.startDate,
            endDate: body.plan.endDate,
          }
        : undefined,
    });

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: model.subject,
      html,
      text: body.message?.trim() ? `${body.message.trim()}\n\n${text}` : text,
    });

    if (error) {
      console.error("Resend share error:", error);
      return NextResponse.json(
        { error: "Couldn’t send the itinerary right now. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, shareId: saved.id });
  } catch (err) {
    console.error("Share itinerary API error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
