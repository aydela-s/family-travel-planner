import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import FeedbackButton from "@/components/FeedbackButton";
import { FeedbackVisibilityProvider } from "@/components/FeedbackVisibility";
import { PostHogProvider } from "@/components/PostHogProvider";
import { BRAND } from "@/config/brand";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.taglineSentence}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.taglineSentence,
  applicationName: BRAND.name,
  icons: {
    icon: [{ url: BRAND.faviconSrc, type: "image/png" }],
    apple: BRAND.markSrc,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} antialiased`}>
        <PostHogProvider>
          <FeedbackVisibilityProvider>
            {children}
            <FeedbackButton />
          </FeedbackVisibilityProvider>
        </PostHogProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
