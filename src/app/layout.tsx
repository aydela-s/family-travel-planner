import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
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
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
