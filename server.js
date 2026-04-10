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

// Analyse by call_id — fetches transcript from Bland directly, no JSON escaping issues
app.post('/analyse-call', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const blandKey = process.env.BLAND_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  if (!blandKey) return res.status(500).json({ error: 'BLAND_API_KEY not set' });

  const { call_id } = req.body;
  if (!call_id) return res.status(400).json({ error: 'call_id required' });

  try {
    // Fetch full call data from Bland
    const callRes = await fetch(`https://api.bland.ai/v1/calls/${call_id}`, {
      headers: { 'authorization': blandKey }
    });
    const callData = await callRes.json();

    const transcripts = callData.transcripts || [];
    const recording_url = callData.recording_url || null;
    const summary = callData.summary || '';
    const answered_by = callData.answered_by || '';
    const call_length = callData.call_length || 0;

    // Build clean transcript string server-side — no escaping needed
    const transcript = transcripts
      .map(t => `${t.user === 'assistant' ? 'AI' : 'Them'}: ${(t.text || '').replace(/"/g, "'").trim()}`)
      .join('\n');

    if (!transcript) {
      return res.json({
        summary: summary || 'No transcript available',
        sentiment: 'Neutral',
        next_step: 'No answer or voicemail — retry tomorrow',
        email: null,
        interested: false,
        key_objection: null,
        transcript: '',
        recording_url,
        answered_by,
        call_length
      });
    }

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
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON object found in response');

    const parsed = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    res.json({ ...parsed, transcript, recording_url, answered_by, call_length });

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

  const INDUSTRY_STYLES = {
    plumber: { color: '#1a3a5c', accent: '#f97316', font: 'Roboto', feel: 'trustworthy and professional', hero: 'Emergency Plumbing? We Are Available 24/7', sections: 'emergency services callout, licensing badges, before/after, service areas map', cta: 'Call Now for Fast Service' },
    hvac: { color: '#0f4c81', accent: '#f59e0b', font: 'Inter', feel: 'reliable and technical', hero: 'Heating & Cooling Experts You Can Trust', sections: 'seasonal specials, energy savings, financing available, maintenance plans', cta: 'Get a Free Estimate' },
    electrician: { color: '#1e293b', accent: '#eab308', font: 'Montserrat', feel: 'bold and safety-focused', hero: 'Licensed Electricians — Fast, Safe & Reliable', sections: 'safety badges, residential vs commercial, 24/7 emergency, permits handled', cta: 'Schedule an Electrician' },
    roofer: { color: '#7c2d12', accent: '#dc2626', font: 'Oswald', feel: 'strong and durable', hero: 'Expert Roofing — Protect Your Home', sections: 'storm damage, insurance claims help, free inspection, warranties', cta: 'Get a Free Roof Inspection' },
    landscaper: { color: '#14532d', accent: '#4ade80', font: 'Lato', feel: 'natural and fresh', hero: 'Beautiful Landscapes, Expertly Maintained', sections: 'seasonal packages, before/after gallery, lawn care schedule, design services', cta: 'Get a Free Quote' },
    'pest control': { color: '#422006', accent: '#f97316', font: 'Roboto', feel: 'clean and reassuring', hero: 'Pest-Free Living Starts Here', sections: 'common pests treated, safe for kids/pets, monthly plans, satisfaction guarantee', cta: 'Book a Free Inspection' },
    'pool service': { color: '#0369a1', accent: '#38bdf8', font: 'Inter', feel: 'clean, fresh and professional', hero: 'Crystal Clear Pools All Year Round', sections: 'weekly maintenance, repairs, opening/closing, chemical balancing, equipment upgrades', cta: 'Get a Free Pool Quote' },
    'carpet cleaning': { color: '#1e3a5f', accent: '#06b6d4', font: 'Nunito', feel: 'clean, fresh and reliable', hero: 'Cleaner Carpets. Healthier Home.', sections: 'before/after gallery, stain removal, pet odor treatment, same-day service, satisfaction guarantee', cta: 'Book a Cleaning Today' },
    'pressure washing': { color: '#1e293b', accent: '#3b82f6', font: 'Oswald', feel: 'powerful and results-driven', hero: 'Make Your Property Shine Again', sections: 'before/after photos, services list, residential and commercial, soft wash option, free estimates', cta: 'Get a Free Estimate' },
    'painting contractor': { color: '#312e81', accent: '#818cf8', font: 'Raleway', feel: 'creative, clean and transformative', hero: 'Fresh Paint. Fresh Start. Expert Results.', sections: 'interior/exterior, color consultation, before/after gallery, licensed and insured, free estimates', cta: 'Get a Free Quote' },
    'fence company': { color: '#292524', accent: '#a78bfa', font: 'Roboto', feel: 'solid, reliable and professional', hero: 'Quality Fencing That Lasts a Lifetime', sections: 'fence types, residential/commercial, free estimates, installation timeline, warranty', cta: 'Get a Free Fence Quote' },
    'garage door repair': { color: '#1c1917', accent: '#f59e0b', font: 'Oswald', feel: 'fast, reliable and professional', hero: 'Garage Door Problems? We Fix Them Fast.', sections: 'same-day service, repair vs replace, spring replacement, new installations, brands serviced', cta: 'Call for Same-Day Service' },
    locksmith: { color: '#0f172a', accent: '#f59e0b', font: 'Roboto', feel: 'trustworthy, fast and reliable', hero: '24/7 Locksmith — Fast Response, Fair Prices', sections: '24/7 emergency, residential, commercial, auto lockout, lock replacement, safe cracking', cta: 'Call Now — We Are Available 24/7' },
    'appliance repair': { color: '#1e3a5f', accent: '#f97316', font: 'Inter', feel: 'reliable, fast and affordable', hero: 'Fast Appliance Repair — Same Day Available', sections: 'appliances serviced, brands supported, same-day service, warranty on repairs, service areas', cta: 'Book a Repair Today' },
    chiropractor: { color: '#1e3a5f', accent: '#10b981', font: 'Raleway', feel: 'wellness and healing', hero: 'Live Pain-Free — Expert Chiropractic Care', sections: 'conditions treated, new patient special, testimonials, what to expect', cta: 'Book a Free Consultation' },
    veterinarian: { color: '#1a4731', accent: '#34d399', font: 'Nunito', feel: 'warm, caring and professional', hero: 'Compassionate Care for Your Pets', sections: 'services, emergency care, wellness plans, meet the vets, pet health tips', cta: 'Book an Appointment' },
    'hair salon': { color: '#3b0764', accent: '#d946ef', font: 'Cormorant Garamond', feel: 'luxurious and stylish', hero: 'Look Your Best — Expert Hair Care', sections: 'services menu with pricing, stylists, gallery, online booking, products used', cta: 'Book Your Style Session' },
    barbershop: { color: '#1a1a2e', accent: '#e94560', font: 'Bebas Neue', feel: 'classic, masculine and sharp', hero: 'Sharp Cuts. Clean Fades. Classic Style.', sections: 'services and pricing, barbers, gallery, walk-ins welcome, loyalty program', cta: 'Book a Cut' },
    'nail salon': { color: '#4a044e', accent: '#f9a8d4', font: 'Cormorant Garamond', feel: 'elegant, relaxing and luxurious', hero: 'Beautiful Nails. Relaxing Experience.', sections: 'services and pricing, nail art gallery, gel and acrylic options, walk-ins welcome, gift cards', cta: 'Book Your Appointment' },
    dentist: { color: '#0c4a6e', accent: '#06b6d4', font: 'Nunito', feel: 'clean, calm and trustworthy', hero: 'Healthy Smiles for the Whole Family', sections: 'services list, new patient offer, insurance accepted, before/after smiles, team photos', cta: 'Book Your Appointment' },
    restaurant: { color: '#1c0a00', accent: '#b45309', font: 'Playfair Display', feel: 'warm, inviting and appetizing', hero: 'Fresh Food. Great Atmosphere. Unforgettable Experience.', sections: 'menu highlights, hours, reservations, story/chef, catering', cta: 'Reserve a Table' },
    bakery: { color: '#431407', accent: '#fb923c', font: 'Playfair Display', feel: 'warm, artisan and inviting', hero: 'Baked Fresh Daily — Made With Love', sections: 'menu/products, daily specials, custom orders, story, local delivery, gift boxes', cta: 'Order Now' },
    florist: { color: '#500724', accent: '#fb7185', font: 'Cormorant Garamond', feel: 'romantic, elegant and beautiful', hero: 'Fresh Flowers for Every Occasion', sections: 'arrangements gallery, occasions covered, same-day delivery, weddings, custom orders', cta: 'Order Fresh Flowers' },
    photographer: { color: '#0f172a', accent: '#a78bfa', font: 'Raleway', feel: 'creative, artistic and premium', hero: 'Capturing Your Most Important Moments', sections: 'portfolio gallery, packages and pricing, wedding/portrait/commercial, client reviews, booking', cta: 'Book Your Session' },
    'personal trainer': { color: '#1a1a2e', accent: '#22c55e', font: 'Montserrat', feel: 'energetic, motivating and results-driven', hero: 'Transform Your Body. Change Your Life.', sections: 'training packages, transformation gallery, certifications, online/in-person, free consultation', cta: 'Book a Free Consult' },
    'cleaning service': { color: '#0f4c81', accent: '#38bdf8', font: 'Nunito', feel: 'clean, fresh and dependable', hero: 'A Cleaner Home — Guaranteed', sections: 'residential/commercial, recurring plans, deep clean, move in/out, eco-friendly products, insured', cta: 'Get a Free Quote' },
    'moving company': { color: '#1c1917', accent: '#f59e0b', font: 'Oswald', feel: 'strong, reliable and stress-free', hero: 'Moving Made Easy — Stress-Free Guaranteed', sections: 'local/long distance, packing services, storage, pricing calculator, licensed and insured', cta: 'Get a Free Moving Quote' },
    'towing company': { color: '#1a1a2e', accent: '#ef4444', font: 'Oswald', feel: 'fast, reliable and professional', hero: 'Stuck? We Are On Our Way.', sections: '24/7 availability, service area, roadside assistance, flatbed/wheel lift, fair pricing', cta: 'Call Now — Fast Response' },
    'drywall contractor': { color: '#292524', accent: '#d97706', font: 'Roboto', feel: 'skilled, precise and professional', hero: 'Flawless Walls. Expert Craftsmanship.', sections: 'installation, repair, textures, painting, commercial/residential, free estimates', cta: 'Get a Free Estimate' },
    'concrete contractor': { color: '#1c1917', accent: '#94a3b8', font: 'Oswald', feel: 'strong, durable and professional', hero: 'Concrete Work Done Right — Built to Last', sections: 'driveways, patios, foundations, stamped concrete, repair, commercial/residential', cta: 'Get a Free Quote' },
    accountant: { color: '#0f172a', accent: '#3b82f6', font: 'Source Sans Pro', feel: 'professional, precise and trustworthy', hero: 'Expert Accounting — Maximize Your Returns', sections: 'services, business vs personal, tax deadline reminders, secure portal, CPA credentials', cta: 'Schedule a Consultation' },
    lawyer: { color: '#1a1a1a', accent: '#b8960c', font: 'Libre Baskerville', feel: 'authoritative, serious and prestigious', hero: 'Experienced Legal Representation You Can Trust', sections: 'practice areas, case results, free consultation, bar memberships, awards', cta: 'Get a Free Consultation' },
    'real estate': { color: '#0f172a', accent: '#f59e0b', font: 'Raleway', feel: 'premium and professional', hero: 'Find Your Dream Home — Local Real Estate Experts', sections: 'featured listings, market stats, buyer/seller guides, testimonials, area expertise', cta: 'Start Your Search' }
  };

  const nicheKey = (placeData.niche || '').toLowerCase().trim();
  const style = INDUSTRY_STYLES[nicheKey] || { color: '#1e293b', accent: '#3b82f6', font: 'Inter', feel: 'modern and professional', hero: 'Professional Services You Can Trust', sections: 'services, about, testimonials, contact', cta: 'Contact Us Today' };

  const prompt = `You are an expert web designer specialising in local business websites. Create a complete, stunning single-page HTML website for this business.

Business:
Name: ${placeData.name}
Type: ${placeData.niche || placeData.types || 'local business'}
Phone: ${placeData.phone || 'Call us'}
Address: ${placeData.address || ''}
Rating: ${placeData.rating ? placeData.rating + ' stars (' + placeData.reviewCount + ' reviews)' : ''}
Description: ${placeData.description || ''}
Hours: ${placeData.hours || ''}

INDUSTRY DESIGN BRIEF:
- Overall feel: ${style.feel}
- Primary color: ${style.color}
- Accent color: ${style.accent}
- Font: ${style.font} from Google Fonts
- Hero headline theme: "${style.hero}"
- Industry-specific sections to include: ${style.sections}
- Primary CTA button text: "${style.cta}"

REQUIREMENTS:
1. Output ONLY raw HTML starting with <!DOCTYPE html> — no markdown, no backticks, nothing else
2. All CSS in a <style> tag — no external stylesheets except one Google Fonts import
3. Use the exact primary and accent colors specified above
4. Sections: sticky nav, hero with large headline + prominent phone CTA button, services, industry-specific sections listed above, trust signals (${placeData.rating ? placeData.rating + ' stars' : 'licensed & insured, years in business'}), contact section with phone number large, footer
5. Add a small top banner: "✨ Free preview — built by LaunchSite"
6. Fully mobile responsive with CSS media queries
7. Write real, compelling copy specific to this business type — not lorem ipsum
8. Smooth scroll between sections
9. Make it genuinely impressive — this is a sales demo that must make the owner say "I need this"

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

app.post('/build-site', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  const { feedback } = req.body;
  if (!feedback?.businessName) return res.status(400).json({ error: 'feedback.businessName required' });

  const SITE_INDUSTRY_STYLES = {
    plumber: { color: '#1a3a5c', accent: '#f97316', font: 'Roboto', feel: 'trustworthy, reliable and urgent', extras: 'Include a 24/7 emergency callout banner, licensing/insurance badges, and a service areas section.' },
    hvac: { color: '#0f4c81', accent: '#f59e0b', font: 'Inter', feel: 'technical, reliable and energy-efficient', extras: 'Include seasonal specials, financing available callout, and an energy savings section.' },
    electrician: { color: '#1e293b', accent: '#eab308', font: 'Montserrat', feel: 'bold, safety-focused and professional', extras: 'Include safety certification badges, residential vs commercial tabs, and a 24/7 emergency callout.' },
    roofer: { color: '#7c2d12', accent: '#dc2626', font: 'Oswald', feel: 'strong, durable and storm-ready', extras: 'Include a storm damage section, insurance claims help callout, and a free inspection offer.' },
    landscaper: { color: '#14532d', accent: '#4ade80', font: 'Lato', feel: 'natural, fresh and beautiful', extras: 'Include seasonal packages, a before/after gallery section, and a lawn care schedule.' },
    'pest control': { color: '#422006', accent: '#f97316', font: 'Roboto', feel: 'clean, reassuring and effective', extras: 'Include a safe for kids/pets callout, common pests list, and monthly plan options.' },
    'pool service': { color: '#0369a1', accent: '#38bdf8', font: 'Inter', feel: 'clean, refreshing and professional', extras: 'Include weekly/monthly maintenance plans, a pool opening/closing section, chemical balancing info, and a free quote offer.' },
    'carpet cleaning': { color: '#1e3a5f', accent: '#06b6d4', font: 'Nunito', feel: 'clean, fresh and trustworthy', extras: 'Include before/after photos, stain removal guarantees, pet odor treatment, and same-day availability.' },
    'pressure washing': { color: '#1e293b', accent: '#3b82f6', font: 'Oswald', feel: 'powerful and results-focused', extras: 'Include before/after gallery, residential and commercial options, soft wash alternative, and free estimate offer.' },
    'painting contractor': { color: '#312e81', accent: '#818cf8', font: 'Raleway', feel: 'creative, clean and transformative', extras: 'Include interior/exterior services, color consultation offer, before/after gallery, and licensed/insured badges.' },
    'fence company': { color: '#292524', accent: '#a78bfa', font: 'Roboto', feel: 'solid, reliable and professional', extras: 'Include fence type gallery (wood, vinyl, chain link, iron), residential/commercial, warranty section, and free estimate.' },
    'garage door repair': { color: '#1c1917', accent: '#f59e0b', font: 'Oswald', feel: 'fast, dependable and professional', extras: 'Include same-day service callout, spring/opener/panel repair sections, new installation option, and brands serviced.' },
    locksmith: { color: '#0f172a', accent: '#f59e0b', font: 'Roboto', feel: 'trustworthy, fast and available 24/7', extras: 'Include 24/7 emergency banner, residential/commercial/auto sections, response time guarantee, and licensed badge.' },
    'appliance repair': { color: '#1e3a5f', accent: '#f97316', font: 'Inter', feel: 'reliable, fast and affordable', extras: 'Include appliances serviced list, brands supported, same-day availability, repair warranty, and service area map.' },
    chiropractor: { color: '#1e3a5f', accent: '#10b981', font: 'Raleway', feel: 'healing, wellness and pain-free', extras: 'Include conditions treated list, a new patient discount, and a what to expect section.' },
    veterinarian: { color: '#1a4731', accent: '#34d399', font: 'Nunito', feel: 'warm, caring and compassionate', extras: 'Include wellness plans, emergency care callout, and a meet the team section.' },
    'hair salon': { color: '#3b0764', accent: '#d946ef', font: 'Cormorant Garamond', feel: 'luxurious, stylish and creative', extras: 'Include a services menu with pricing, stylist profiles, and an online booking section.' },
    barbershop: { color: '#1a1a2e', accent: '#e94560', font: 'Bebas Neue', feel: 'classic, sharp and masculine', extras: 'Include a services and pricing table, walk-ins welcome callout, and a barber profiles section.' },
    'nail salon': { color: '#4a044e', accent: '#f9a8d4', font: 'Cormorant Garamond', feel: 'elegant, relaxing and luxurious', extras: 'Include services and pricing, nail art gallery, gel/acrylic options, walk-ins welcome banner, and gift card section.' },
    dentist: { color: '#0c4a6e', accent: '#06b6d4', font: 'Nunito', feel: 'clean, calming and trustworthy', extras: 'Include a new patient special offer, insurance accepted logos, and a before/after smiles gallery.' },
    restaurant: { color: '#1c0a00', accent: '#b45309', font: 'Playfair Display', feel: 'warm, inviting and appetizing', extras: 'Include a menu highlights section, reservation form, and a catering services callout.' },
    bakery: { color: '#431407', accent: '#fb923c', font: 'Playfair Display', feel: 'warm, artisan and inviting', extras: 'Include daily specials, custom order form, signature items gallery, local delivery info, and story section.' },
    florist: { color: '#500724', accent: '#fb7185', font: 'Cormorant Garamond', feel: 'romantic, elegant and beautiful', extras: 'Include arrangement gallery, occasions covered (weddings, funerals, birthdays), same-day delivery, and custom order form.' },
    photographer: { color: '#0f172a', accent: '#a78bfa', font: 'Raleway', feel: 'creative, artistic and premium', extras: 'Include portfolio gallery with categories, packages and pricing, wedding/portrait/commercial tabs, and booking form.' },
    'personal trainer': { color: '#1a1a2e', accent: '#22c55e', font: 'Montserrat', feel: 'energetic, motivating and results-driven', extras: 'Include transformation gallery, training packages, certifications, online/in-person options, and free consultation offer.' },
    'cleaning service': { color: '#0f4c81', accent: '#38bdf8', font: 'Nunito', feel: 'clean, fresh and dependable', extras: 'Include residential/commercial, recurring service plans, deep clean option, move in/out cleaning, and insured/bonded badge.' },
    'moving company': { color: '#1c1917', accent: '#f59e0b', font: 'Oswald', feel: 'strong, reliable and stress-free', extras: 'Include local/long distance, packing services, storage option, pricing calculator, and licensed/insured badges.' },
    'towing company': { color: '#1a1a2e', accent: '#ef4444', font: 'Oswald', feel: 'fast, reliable and always available', extras: 'Include 24/7 banner, service area map, roadside assistance section, flatbed/wheel lift info, and response time.' },
    'drywall contractor': { color: '#292524', accent: '#d97706', font: 'Roboto', feel: 'skilled, precise and professional', extras: 'Include installation/repair/texture services, before/after gallery, commercial/residential, and free estimate offer.' },
    'concrete contractor': { color: '#1c1917', accent: '#94a3b8', font: 'Oswald', feel: 'strong, durable and professional', extras: 'Include driveways, patios, foundations, stamped concrete gallery, repair services, and free quote offer.' },
    accountant: { color: '#0f172a', accent: '#3b82f6', font: 'Source Sans Pro', feel: 'professional, precise and trustworthy', extras: 'Include tax deadline reminders, business vs personal services, and a secure portal callout.' },
    lawyer: { color: '#1a1a1a', accent: '#b8960c', font: 'Libre Baskerville', feel: 'authoritative, serious and prestigious', extras: 'Include practice areas, notable case results, bar memberships, and a free consultation offer.' },
    'real estate': { color: '#0f172a', accent: '#f59e0b', font: 'Raleway', feel: 'premium, professional and aspirational', extras: 'Include featured listings, market stats, buyer/seller guides, and area expertise sections.' }
  };

  const typeKey = (feedback.type || '').toLowerCase().trim();
  const indStyle = SITE_INDUSTRY_STYLES[typeKey] || { color: '#1e293b', accent: '#3b82f6', font: 'Inter', feel: 'modern, professional and conversion-focused', extras: '' };

  const prompt = `You are an expert web designer specialising in local business websites. Build a complete, stunning, production-quality single-page website based on this brief.

CLIENT BRIEF:
Business: ${feedback.businessName}
Type: ${feedback.type || 'local business'}
Location: ${feedback.location || ''}
Phone: ${feedback.phone || ''}
Services: ${feedback.services || ''}
Target customers: ${feedback.customers || ''}
Tagline / differentiator: ${feedback.tagline || ''}
Style preference: ${feedback.style || indStyle.feel}
Colour preference: ${feedback.color !== 'choose the best color for this industry' ? feedback.color : `Primary ${indStyle.color}, Accent ${indStyle.accent}`}
Font: ${indStyle.font} from Google Fonts
Main CTA: ${feedback.cta || 'Contact Us Today'}
Trust signals: ${feedback.trust || 'Licensed & Insured, Years of Experience, 5-Star Reviews'}
Sections to include: ${feedback.sections || 'Hero, Services, About, Testimonials, Contact Form'}
Special requests: ${feedback.extra || 'none'}

INDUSTRY DESIGN NOTES:
Overall feel: ${indStyle.feel}
${indStyle.extras}

REQUIREMENTS:
- Complete self-contained HTML with all CSS in a <style> tag
- Google Fonts import for ${indStyle.font}
- Use primary color ${indStyle.color} and accent ${indStyle.accent} throughout
- Every section from the brief must be present
- Mobile responsive with CSS media queries
- Write real, compelling, industry-specific copy — not lorem ipsum
- Smooth scroll navigation with sticky header
- Hero has a large headline and prominent phone CTA button
- Footer with phone, address, copyright
- Make it genuinely beautiful and conversion-focused — the business owner must want to buy it

START YOUR RESPONSE WITH <!DOCTYPE html> AND NOTHING ELSE.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
        })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const parts = data.candidates?.[0]?.content?.parts || [];
    let html = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
    html = html.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```\s*$/i,'').trim();
    const startIdx = html.toLowerCase().indexOf('<!doctype');
    if (startIdx === -1) throw new Error('No valid HTML in response');
    res.json({ html: html.substring(startIdx) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/revise-site', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  const { html, instruction } = req.body;
  if (!html || !instruction) return res.status(400).json({ error: 'html and instruction required' });

  const prompt = `You are an expert web designer. You will receive an existing website HTML and a change request. Apply the requested changes precisely and return the complete updated HTML.

CHANGE REQUEST:
${instruction}

EXISTING HTML:
${html}

RULES:
- Return ONLY the complete updated HTML document
- Keep everything that wasn't mentioned in the change request exactly as is
- Apply the changes accurately and professionally
- Do not add explanations or comments
- START YOUR RESPONSE WITH <!DOCTYPE html> AND NOTHING ELSE.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
        })
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const parts = data.candidates?.[0]?.content?.parts || [];
    let html2 = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
    html2 = html2.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```\s*$/i,'').trim();
    const startIdx = html2.toLowerCase().indexOf('<!doctype');
    if (startIdx === -1) throw new Error('No valid HTML in response');
    res.json({ html: html2.substring(startIdx) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bland AI proxy v3 running on port ${PORT}`);
});
