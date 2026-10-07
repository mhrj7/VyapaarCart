import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "vyapaarcart.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "VyapaarCart | Good things deserve another story",
    description: "A safer, friendlier local marketplace for buying and selling good things.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "VyapaarCart | Good things deserve another story",
      description: "A safer, friendlier local marketplace for buying and selling good things.",
      images: [{ url: image, width: 1720, height: 956, alt: "VyapaarCart marketplace" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "VyapaarCart | Good things deserve another story",
      description: "A safer, friendlier local marketplace for buying and selling good things.",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
