import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

export const metadata: Metadata = {
  metadataBase,
  title: "FollowPact — A freelancer operating system for developers",
  description: "Organize client work, plan available time, track outreach and payments, and protect new projects before work begins.",
  keywords: ["freelancer operating system", "freelance developer project tracker", "invoice tracker", "outreach tracker", "project time planner"],
  alternates: siteUrl ? { canonical: "/" } : undefined,
  openGraph: { title: "Ship the work you keep putting off | FollowPact", description: "One lightweight operating system for freelance developers: client work, time, invoices, outreach, and project scope.", type: "website", ...(siteUrl ? { url: "/", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "FollowPact freelancer operating system" }] } : {}) },
  twitter: { card: "summary_large_image", title: "FollowPact — Built for freelance developers", description: "Client work, time, invoices, outreach, and project scope in one lightweight system.", ...(siteUrl ? { images: ["/og.png"] } : {}) },
  icons: { icon: "/followpact-logo.png", shortcut: "/followpact-logo.png", apple: "/followpact-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cloudflareToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
  return <html lang="en"><body>{children}{cloudflareToken ? <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" data-cf-beacon={JSON.stringify({ token: cloudflareToken })} /> : null}</body></html>;
}
