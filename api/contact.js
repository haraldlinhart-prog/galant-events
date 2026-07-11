// Catches bot-generated random tokens that are short enough to slide past a simple
// length check but look nothing like a real word: very few vowels AND unnaturally
// frequent upper/lowercase switching. Both conditions required together to avoid
// flagging real oddly-cased words (e.g. "McDonald").
function isGibberish(str) {
  const words = (str || '').split(/\s+/).filter(w => w.length >= 6);
  const vowelChars = 'aeiouyAEIOUYäöüÄÖÜàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ';
  for (const word of words) {
    const letters = word.replace(/[^a-zA-ZäöüÄÖÜßàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ]/g, '');
    if (letters.length < 6) continue;
    let vowels = 0;
    for (const ch of letters) if (vowelChars.includes(ch)) vowels++;
    const vowelRatio = vowels / letters.length;
    let transitions = 0;
    for (let i = 1; i < letters.length; i++) {
      const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase() && letters[i - 1] !== letters[i - 1].toLowerCase();
      const curUpper = letters[i] === letters[i].toUpperCase() && letters[i] !== letters[i].toLowerCase();
      if (prevUpper !== curUpper) transitions++;
    }
    const transitionRatio = transitions / (letters.length - 1);
    if (vowelRatio < 0.2 && transitionRatio > 0.35) return true;
  }
  if (/\S{61,}/.test(str || '')) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, message, elapsed } = req.body || {};

  // Gibberish-Bot-Erkennung (kurze Zufallsstrings) — silent success wie Honeypot
  if (isGibberish(message) || isGibberish(name)) { return res.status(200).json({ ok: true }); }

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
