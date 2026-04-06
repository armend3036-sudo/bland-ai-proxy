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

Return ONLY valid JSON with exactly these keys:
- summary: 2 sentence plain English summary of what happened
- sentiment: one of exactly: Very Positive, Positive, Neutral, Negative, Very Negative
- next_step: short recommended action e.g. "Send demo link today", "Follow up Friday", "No action needed"
- email: email address if the prospect mentioned one during the call, otherwise null
- interested: true or false — was the prospect genuinely interested?
- key_objection: the main objection they raised, or null if none

No markdown, no explanation, just the JSON object.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
        })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bland AI proxy v3 running on port ${PORT}`);
});
