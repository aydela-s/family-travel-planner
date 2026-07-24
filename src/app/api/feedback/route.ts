import { NextResponse } from "next/server";
import { Resend } from "resend";
import { BRAND } from "@/config/brand";
import { buildFeedbackEmail, validateFeedbackPayload } from "@/lib/feedback";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateFeedbackPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const to = process.env.FEEDBACK_TO_EMAIL?.trim();
    const from =
      process.env.FEEDBACK_FROM_EMAIL?.trim() || "TripNestly Feedback <onboarding@resend.dev>";

    if (!apiKey || !to) {
      console.error("Feedback API missing RESEND_API_KEY or FEEDBACK_TO_EMAIL");
      return NextResponse.json(
        { error: "Feedback is not configured on this server yet." },
        { status: 503 },
      );
    }

    const { subject, text, html } = buildFeedbackEmail({
      message: validated.message,
      email: validated.email,
      pageUrl: validated.pageUrl,
      brandName: BRAND.name,
    });

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
      ...(validated.email ? { replyTo: validated.email } : {}),
    });

    if (error) {
      console.error("Resend feedback error:", error);
      return NextResponse.json(
        { error: "Couldn’t send feedback right now. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback API error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
