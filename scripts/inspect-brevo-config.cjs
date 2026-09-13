if (!process.env.BREVO_API_KEY) throw new Error('Brevo API key is required');

const headers = { 'api-key': process.env.BREVO_API_KEY, Accept: 'application/json' };
const configured = {
  purchase: process.env.BREVO_PURCHASE_TEMPLATE_ID || null,
  refund: process.env.BREVO_REFUND_TEMPLATE_ID || null,
  betaAccess: process.env.BREVO_BETA_ACCESS_TEMPLATE_ID || null,
  sender: process.env.BREVO_SENDER_EMAIL || null,
};

async function get(path) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Brevo ${path} returned HTTP ${response.status}: ${body.code || body.message || 'unknown error'}`);
  return body;
}

(async () => {
  const [templates, senders, refundTemplate, accessTemplate, blocked] = await Promise.all([
    get('/smtp/templates?limit=50&offset=0'),
    get('/senders'),
    configured.refund ? get(`/smtp/templates/${encodeURIComponent(configured.refund)}`) : Promise.resolve(null),
    configured.betaAccess ? get(`/smtp/templates/${encodeURIComponent(configured.betaAccess)}`) : Promise.resolve(null),
    get('/smtp/blockedContacts?limit=100&offset=0'),
  ]);
  const summary = {
    configured,
    templates: (templates.templates || []).map((template) => ({
      id: template.id, name: template.name, active: template.isActive,
      sender: template.sender?.email, subject: template.subject,
    })),
    senders: (senders.senders || []).map((sender) => ({
      id: sender.id, email: sender.email, active: sender.active,
    })),
    refundTemplate: refundTemplate && {
      id: refundTemplate.id, active: refundTemplate.isActive,
      htmlLength: refundTemplate.htmlContent?.length || 0,
      variables: [...new Set((`${refundTemplate.subject || ''} ${refundTemplate.htmlContent || ''}`).match(/\{\{[^}]+\}\}/g) || [])].slice(0, 25),
    },
    accessTemplateText: accessTemplate?.htmlContent?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 1100),
    blockedTestRecipient: (blocked.contacts || []).filter((contact) =>
      contact.email === process.argv[2]).map((contact) => ({
      reason: contact.reason?.code, senderEmail: contact.senderEmail,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
