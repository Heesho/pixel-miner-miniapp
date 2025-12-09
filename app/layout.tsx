import "@/app/globals.css";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Providers } from "@/components/providers";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

const appDomain = "https://farplace-miniapp.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

const miniAppEmbed = {
  version: "next",
  imageUrl: heroImageUrl,
  button: {
    title: "Open Farplace",
    action: {
      type: "launch_miniapp" as const,
      name: "Farplace",
      url: appDomain,
      splashImageUrl,
      splashBackgroundColor: "#18181b",
    },
  },
};

export const metadata: Metadata = {
  title: "Farplace",
  description: "Mine tiles and earn rewards on Base blockchain.",
  openGraph: {
    title: "Farplace",
    description: "Mine tiles and earn rewards on Base blockchain.",
    url: appDomain,
    images: [
      {
        url: heroImageUrl,
      },
    ],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} font-space-mono`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
