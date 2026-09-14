import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

export const metadata: Metadata = {
  metadataBase,
  title: "The Project ERP for Freelance Developers | FollowPact",
  description: "Stop scope creep, track hours, and secure upfront approval in one dashboard.",
  keywords: ["freelance developer project ERP", "Client Scope-Lock", "freelance invoice tracker", "project time planner", "freelancer operating system"],
  alternates: siteUrl ? { canonical: "/" } : undefined,
  openGraph: { title: "The Project ERP for Freelance Developers | FollowPact", description: "Stop scope creep, track hours, and secure upfront approval in one dashboard.", type: "website", ...(siteUrl ? { url: "/", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "FollowPact project dashboard" }] } : {}) },
  twitter: { card: "summary_large_image", title: "The Project ERP for Freelance Developers | FollowPact", description: "Stop scope creep, track hours, and secure upfront approval in one dashboard.", ...(siteUrl ? { images: ["/og.png"] } : {}) },
  icons: { icon: "/followpact-logo.png", shortcut: "/followpact-logo.png", apple: "/followpact-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" data-cf-beacon={JSON.stringify({ token: "af5dfe7839554eb885842183edd5750b" })} /></body></html>;
}
