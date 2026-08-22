import type { Metadata } from "next";
import {
  DM_Sans,
  IBM_Plex_Sans,
  Inter,
  Manrope,
  Newsreader,
  Outfit,
  Source_Serif_4,
} from "next/font/google";
import { notFound } from "next/navigation";
import "@/design-lab/design-lab.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-plex",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-lab-serif",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-lab-news",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-dm",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-outfit",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-manrope",
});

export const metadata: Metadata = {
  title: "Design Lab",
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DESIGN_LAB === "true";
  if (!enabled) notFound();

  return (
    <div
      className={`lab-root ${ibmPlex.variable} ${sourceSerif.variable} ${newsreader.variable} ${dmSans.variable} ${outfit.variable} ${inter.variable} ${manrope.variable}`}
    >
      {children}
    </div>
  );
}
