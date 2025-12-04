import "@/app/globals.css";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Providers } from "@/components/providers";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

const appDomain = "https://pixel-miner-miniapp.vercel.app";
const heroImageUrl = `${appDomain}/media/hero.png`;
const splashImageUrl = `${appDomain}/media/splash.png`;

const miniAppEmbed = {
  version: "1",
  imageUrl: heroImageUrl,
  button: {
    title: "Start Mining",
    action: {
      type: "launch_miniapp" as const,
      name: "Pixel Miner",
      url: appDomain,
      splashImageUrl,
      splashBackgroundColor: "#FEE7EC",
    },
  },
};

export const metadata: Metadata = {
  title: "Pixel Miner",
  description: "Mine pixels and earn rewards on Base blockchain.",
  openGraph: {
    title: "Pixel Miner - Mine Pixels on Base",
    description: "Command your pixel mining operation and compete with other miners to earn rewards.",
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
