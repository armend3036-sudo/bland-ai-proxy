const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const BLAND_API = 'https://api.bland.ai/v1';
const PLACES_API = 'https://places.googleapis.com/v1/places:searchText';

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Bland AI proxy running', version: '2.0.0' });
});

app.get('/test', async (req, res) => {
  const blandKey = process.env.BLAND_API_KEY;
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set' });
  try {
    const response = await fetch(`${BLAND_API}/calls?limit=1`, {
      headers: { 'authorization': blandKey }
    });
    if (response.ok) {
      res.json({ status: 'connected', message: 'Bland AI connection successful' });
    } else {
      const err = await response.json();
      res.status(400).json({ error: 'Bland API error', details: err });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/places', async (req, res) => {
  const googleKey = process.env.GOOGLE_PLACES_KEY;
  if (!googleKey) return res.status(500).json({ error: 'GOOGLE_PLACES_KEY not set' });
  try {
    const response = await fetch(PLACES_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/call', async (req, res) => {
  const blandKey = process.env.BLAND_API_KEY;
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set' });

  const agentName = process.env.AGENT_NAME || 'Alex';
  const agencyName = process.env.AGENCY_NAME || 'LaunchSite';
  const offer = process.env.OFFER || '$599 one-time';
  const demoUrl = process.env.DEMO_URL || 'our website';

  const task = (req.body.task || '')
    .replace(/{{agentName}}/g, agentName)
    .replace(/{{agencyName}}/g, agencyName)
    .replace(/{{offer}}/g, offer)
    .replace(/{{demoUrl}}/g, demoUrl);

  const body = {
    phone_number: req.body.phone_number,
    task,

    // Voice & personality
    voice: 'maya',
    model: 'enhanced',
    language: 'en-US',
    temperature: 0.8,

    // Make it sound human — pause, listen, don't rush
    wait_for_greeting: true,
    block_interruptions: false,
    interruption_threshold: 150,
    noise_cancellation: true,

    // Pacing — critical for sounding human
    first_sentence: `Hey, is this the owner of ${req.body.business_name || 'the business'}?`,

    // Natural filler words and pauses
    filler_words: true,

    // Call settings
    record: true,
    max_duration: 5,
    answered_by_enabled: true,

    // Voicemail
    voicemail_message: `Hey, this is ${agentName} from ${agencyName}. I actually built a free website for your business and wanted to show you — no pitch, just wanted your thoughts. You can check it out at ${demoUrl}. Give me a call back whenever, thanks!`,

    // Metadata
    metadata: req.body.metadata || {}
  };

  try {
    const response = await fetch(`${BLAND_API}/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authorization': blandKey },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/call/:id', async (req, res) => {
  const blandKey = process.env.BLAND_API_KEY;
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set' });
  try {
    const response = await fetch(`${BLAND_API}/calls/${req.params.id}`, {
      headers: { 'authorization': blandKey }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/calls', async (req, res) => {
  const blandKey = process.env.BLAND_API_KEY;
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set' });
  try {
    const limit = req.query.limit || 20;
    const response = await fetch(`${BLAND_API}/calls?limit=${limit}`, {
      headers: { 'authorization': blandKey }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/analyse', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set in Railway variables' });

  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'No transcript provided' });

  const prompt = `You are analysing a sales call transcript for a web design agency.

Transcript:
${transcript}

Return ONLY a raw JSON object with exactly these keys (no markdown, no backticks, no explanation, just the JSON):
{
  "summary": "2 sentence plain English summary of what happened",
  "sentiment": "one of: Very Positive, Positive, Neutral, Negative, Very Negative",
  "next_step": "short recommended action e.g. Send demo link today",
  "email": "email address if mentioned, or null",
  "interested": true or false,
  "key_objection": "main objection raised, or null"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const parts = data.candidates?.[0]?.content?.parts || [];
    const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();

    if (!raw) throw new Error('Empty response from Gemini');

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON object found in response');

    const parsed = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    res.json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/generate-page', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const googleKey = process.env.GOOGLE_PLACES_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  if (!googleKey) return res.status(500).json({ error: 'GOOGLE_PLACES_KEY not set' });

  const { placeId, businessName, phone, address, niche } = req.body;
  if (!businessName) return res.status(400).json({ error: 'businessName required' });

  let placeData = { name: businessName, phone, address, niche };

  if (placeId) {
    try {
      const placeRes = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': googleKey,
            'X-Goog-FieldMask': 'displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,regularOpeningHours,editorialSummary,types'
          }
        }
      );
      const pd = await placeRes.json();
      if (!pd.error) {
        placeData = {
          name: pd.displayName?.text || businessName,
          phone: pd.nationalPhoneNumber || phone,
          address: pd.formattedAddress || address,
          website: pd.websiteUri,
          rating: pd.rating,
          reviewCount: pd.userRatingCount,
          description: pd.editorialSummary?.text,
          hours: pd.regularOpeningHours?.weekdayDescriptions?.join(' | '),
          types: (pd.types || []).slice(0,3).join(', '),
          niche
        };
      }
    } catch (e) {}
  }

  const prompt = `You are an expert web designer. Create a complete, modern, beautiful single-page HTML website for this business.

Business:
Name: ${placeData.name}
Type: ${placeData.niche || placeData.types || 'local business'}
Phone: ${placeData.phone || 'Call us'}
Address: ${placeData.address || ''}
Rating: ${placeData.rating ? placeData.rating + ' stars (' + placeData.reviewCount + ' reviews)' : ''}
Description: ${placeData.description || ''}
Hours: ${placeData.hours || ''}

CRITICAL REQUIREMENTS - you MUST follow all of these:
1. Output ONLY the HTML. No explanation, no markdown, no code fences, no backticks. Just raw HTML starting with <!DOCTYPE html>
2. All CSS must be inside a <style> tag in the <head>. No external CSS files.
3. Use one Google Fonts import link for typography
4. Sections: hero with big headline + CTA phone button, services/about, trust signals, contact with phone
5. Add a small top banner: "✨ Free preview — built by LaunchSite"
6. Fully mobile responsive using CSS media queries
7. Pick a bold, professional color scheme that fits their industry
8. Make it genuinely impressive — this must convince the owner to buy

START YOUR RESPONSE WITH <!DOCTYPE html> AND NOTHING ELSE.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const parts = data.candidates?.[0]?.content?.parts || [];
    const textParts = parts.filter(p => p.text && !p.thought);
    let html = textParts.map(p => p.text).join('').trim();

    html = html
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    const doctypeIdx = html.toLowerCase().indexOf('<!doctype');
    const htmlTagIdx = html.toLowerCase().indexOf('<html');
    const startIdx = doctypeIdx !== -1 ? doctypeIdx : htmlTagIdx !== -1 ? htmlTagIdx : -1;

    if (startIdx === -1) throw new Error('No valid HTML found in response');

    html = html.substring(startIdx);

    res.json({ html, businessName: placeData.name, placeData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/deploy-page', async (req, res) => {
  const netlifyToken = process.env.NETLIFY_TOKEN;
  if (!netlifyToken) return res.status(500).json({ error: 'NETLIFY_TOKEN not set in Railway variables' });

  const { html, businessName } = req.body;
  if (!html) return res.status(400).json({ error: 'No HTML provided' });

  const crypto = require('crypto');
  const slug = (businessName || 'business')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  const siteName = `${slug}-preview-${Date.now().toString(36)}`;

  try {
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: siteName })
    });
    const site = await siteRes.json();
    if (site.errors) throw new Error(site.errors[0] || 'Failed to create Netlify site');

    const sha1 = crypto.createHash('sha1').update(html).digest('hex');
    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: { '/index.html': sha1 } })
    });
    const deploy = await deployRes.json();
    if (deploy.errors) throw new Error(deploy.errors[0] || 'Failed to create deploy');

    const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: html
    });
    if (!uploadRes.ok) throw new Error('Failed to upload HTML to Netlify');

    const liveUrl = `https://${site.default_domain}`;
    res.json({ url: liveUrl, siteId: site.id, siteName: site.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/send-email', async (req, res) => {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set in Railway variables' });

  const { to, subject, body, fromName } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject and body are required' });

  const agencyName = fromName || process.env.AGENCY_NAME || 'LaunchSite';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${agencyName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text: body
      })
    });
    const data = await resendRes.json();
    if (!resendRes.ok) throw new Error(data?.message || data?.name || JSON.stringify(data));
    res.json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bland AI proxy v3 running on port ${PORT}`);
});
