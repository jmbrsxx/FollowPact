const origin = 'https://followpact.netlify.app';

(async () => {
  const [home, status, checkout, invalidSuccess] = await Promise.all([
    fetch(origin, { cache: 'no-store' }),
    fetch(`${origin}/api/offer-status`, { cache: 'no-store' }),
    fetch(`${origin}/checkout?source=deployment-check`, { redirect: 'manual', cache: 'no-store' }),
    fetch(`${origin}/payment/success?session_id=invalid`, { cache: 'no-store' }),
  ]);
  const [homeHtml, statusBody, successHtml] = await Promise.all([home.text(), status.text(), invalidSuccess.text()]);
  console.log(JSON.stringify({
    homeStatus: home.status, fixedSpotsCopy: homeHtml.includes('25 spots left'),
    pageMentions25Seats: homeHtml.includes('Limited to 25 founding seats'),
    offerStatus: status.status, offerBody: statusBody,
    checkoutStatus: checkout.status,
    checkoutIsTestLink: checkout.headers.get('location')?.includes('/test_') || false,
    invalidSuccessStatus: invalidSuccess.status,
    invalidSessionShowsPaymentReceived: successHtml.includes('Payment received.'),
  }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
