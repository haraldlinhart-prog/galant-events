export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, message, elapsed } = req.body || {};

  // Dwell time
  if (!elapsed || elapsed < 3) return res.status(400).json({ error: 'too_fast' });

  // Basic validation
  if (!name || !email || !message) return res.status(400).json({ error: 'missing_fields' });

  // Content filter: no word longer than 20 chars without space = bot
  const looksHuman = !message.split(/\s+/).some(w => w.length > 20);
  if (!looksHuman) return res.status(400).json({ error: 'spam' });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Galant Kontaktformular <noreply@pan21.com>`,
        to: ['galant@pan21.com'],
        reply_to: email,
        subject: `Kontaktanfrage Galant – ${name}`,
        text: `Name: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}`
      })
    });

    if (!r.ok) throw new Error(await r.text());
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'send_failed' });
  }
}
