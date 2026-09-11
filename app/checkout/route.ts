import { NextResponse } from "next/server";
import { recordConversionSafely, sanitizeAttribution } from "@/lib/analytics";
import { getCheckoutUrl, getOfferStatus } from "@/lib/offer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    const referrerHeader = request.headers.get("referer");
    const referrer = referrerHeader ? new URL(referrerHeader) : null;
    const status = await getOfferStatus();
    const checkoutUrl = getCheckoutUrl(status.isOpen);
    if (!checkoutUrl) return NextResponse.redirect(new URL("/payment/unavailable", request.url), 303);

    const kind = status.isOpen ? "founding" : "subscription";
    const cookieName = `fp_checkout_${kind}`;
    const alreadyRecorded = request.headers.get("cookie")?.split(";").some((part) => part.trim().startsWith(`${cookieName}=`));
    if (!alreadyRecorded) {
      await recordConversionSafely("checkout_started", {
        source: sanitizeAttribution(requestUrl.searchParams.get("source") || "landing-page", 80),
        page: sanitizeAttribution(referrer?.pathname || "/", 160),
        utmSource: requestUrl.searchParams.get("utm_source") || referrer?.searchParams.get("utm_source"),
        utmMedium: requestUrl.searchParams.get("utm_medium") || referrer?.searchParams.get("utm_medium"),
        utmCampaign: requestUrl.searchParams.get("utm_campaign") || referrer?.searchParams.get("utm_campaign"),
        referenceId: kind,
      });
    }

    const response = NextResponse.redirect(checkoutUrl, 303);
    response.cookies.set(cookieName, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 60, path: "/" });
    return response;
  } catch (error) {
    console.error("Checkout redirect failed", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/payment/unavailable", request.url), 303);
  }
}
