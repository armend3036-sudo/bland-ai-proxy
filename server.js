const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const BLAND_API = 'https://api.bland.ai/v1';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Bland AI proxy running', version: '1.0.0' });
});

// Send a call
app.post('/call', async (req, res) => {
  const blandKey = process.env.BLAND_API_KEY;
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set in environment variables' });

  try {
    const response = await fetch(`${BLAND_API}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': blandKey
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get call status
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

// List recent calls
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

// Test connection
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

app.listen(PORT, () => {
  console.log(`Bland AI proxy running on port ${PORT}`);
});
