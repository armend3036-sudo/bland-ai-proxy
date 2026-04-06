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
  const body = {
    ...req.body,
    task: (req.body.task || '')
      .replace(/{{agentName}}/g, agentName)
      .replace(/{{agencyName}}/g, agencyName)
      .replace(/{{offer}}/g, offer)
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

app.listen(PORT, () => {
  console.log(`Bland AI proxy v2 running on port ${PORT}`);
});
