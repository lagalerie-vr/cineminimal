import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cineminimal.app'),
  title: {
    default: "CineMinimal | Premium Cinema Experience",
    template: "%s | CineMinimal"
  },
  description: "Watch the latest movies, TV shows, and Anime in high quality with Arabic subtitles. Minimalist, fast, and free.",
  keywords: ["streaming", "movies", "tv shows", "anime", "arabic subtitles", "minimalist cinema"],
  authors: [{ name: "CineMinimal" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cineminimal.app",
    siteName: "CineMinimal",
    title: "CineMinimal | Premium Cinema Experience",
    description: "Watch the latest movies, TV shows, and Anime in high quality with Arabic subtitles.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "CineMinimal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CineMinimal | Premium Cinema Experience",
    description: "High-quality streaming with a minimalist interface.",
    images: ["/og-image.png"],
  },
  other: {
    "google-adsense-account": "ca-pub-5100101778180471",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <footer className="py-12 border-t border-white/5 mt-20">
            <div className="container mx-auto px-6 text-center text-muted text-sm">
              <p>&copy; {new Date().getFullYear()} CineMinimal. All rights reserved.</p>
              <p className="mt-2 text-xs">Created with &hearts; by Mohamed Elwed</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
