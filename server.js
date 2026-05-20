'use strict';
require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const path = require('path');
const { generateImage } = require('./src/services/fireflyService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory session storage: sessionId -> messages[]
const sessions = new Map();

const SYSTEM_PROMPT = `You are WeatherBuddy, an enthusiastic outdoor activity weather planning assistant. Today's date is ${new Date().toISOString().split('T')[0]}.

## Clarification rules (ALWAYS apply first):
- If the activity is missing or too vague (e.g. just "outside", "something fun") → ask what activity they have in mind
- If the location is missing → ask where
- If the time range is ambiguous (e.g. "soon", "later") → ask when they are thinking
- Never ask more than 2 questions at once

## Time range rules (CRITICAL):
The weather tool only provides reliable data for the NEXT 5–7 DAYS from today.

Detect the time range the user is asking about and respond accordingly:

- **"today" / "tonight" / "tomorrow"** → AVAILABLE. Call the tool, filter to relevant day(s).
- **"this week" / "this weekend" / "next few days"** → AVAILABLE. Call the tool, show the full 5–7 day window.
- **"next week"** (7–14 days away) → NOT AVAILABLE. Apologise, explain forecast data only covers the next 5–7 days reliably, and ask if they'd like to plan for this week instead.
- **"next month" / "in two months" / any date more than 7 days away** → NOT AVAILABLE. Explain clearly that weather forecasts beyond 7 days are not reliable or available from your data source. Ask them to come back closer to the date or ask about this week.
- **Specific future date more than 7 days away** → NOT AVAILABLE. Same response as above.

NEVER call get_weather_forecast if the requested time is more than 7 days from today. Only respond conversationally and redirect.

## Route planning rule:
NEVER ask the user where they are starting from. Do NOT proactively ask for an origin city.

If the user has NOT provided a starting location, after giving the recommendation add one short line like:
"💡 Tip: tell me where you're travelling from and I'll add directions!"

If the user HAS already mentioned their starting city (e.g. "I'm coming from Berlin"), call get_route with:
- origin: the user's starting city as they typed it
- destination: the resolvedLocation string returned by get_weather_forecast
- mode: "driving" by default (do NOT ask the user which mode)

Use the result to populate a "route" object in the final recommendation JSON. If the user has not provided an origin, OMIT the "route" field entirely — do not invent one.

## Activity scoring:
- Camping: temps 8–25°C, precipitation < 2mm/day, wind < 30 km/h, no thunderstorms
- Hiking: temps 5–22°C, clear/partly cloudy, precipitation < 1mm, wind < 25 km/h
- Sunbathing/beach: temps 22°C+, clear skies, no rain
- Jogging/running: temps 8–18°C, no heavy rain, wind < 25 km/h
- Festival/picnic/outdoor event: temps 15–28°C, no rain, wind < 20 km/h
- General outdoor: comfortable temps, low precipitation

Score EVERY available day 1–10 for the specific activity (10 = perfect).
Recommend the BEST 1 day with a specific time window. Show ALL days in the JSON.

## CRITICAL chat response rules — read carefully:
Your conversational text (outside the JSON block) must follow these rules STRICTLY:

1. **Maximum 2–3 short sentences. Hard limit. No exceptions.**
2. **NEVER use markdown tables, ### headers, or --- horizontal rules in the chat text.**
3. **NEVER repeat the day-by-day data breakdown in chat** — that data lives in the visual forecast card.
4. Just say: what the best day is + one punchy reason why + optionally one quick tip.
5. Warm and direct tone, like a knowledgeable friend. Not a report. Not a briefing.

WRONG: "Here is my full analysis:\n| Day | Temp | Precip |\n|---|---|---|\n| Monday | 18°C | 0mm |..."
RIGHT: "Saturday is your window ☀️ — clear all day, 23°C, barely any wind. Get out early before it warms up!"

## Response format:
After your conversational reply, if you have a recommendation, append EXACTLY this JSON block with no extra text after it:

\`\`\`json
{
  "type": "recommendation",
  "activity": "camping",
  "location": "Lake Tahoe, CA",
  "bestDay": {
    "date": "2024-05-20",
    "dayName": "Monday",
    "location": "Innsbruck, AT",
    "timeWindow": "9:00 AM - 6:00 PM",
    "score": 9,
    "summary": "Clear skies, 18°C, perfect for camping!"
  },
  "allDays": [
    {
      "date": "2024-05-20",
      "dayName": "Monday",
      "location": "Innsbruck, AT",
      "tempMin": 12,
      "tempMax": 22,
      "condition": "Clear",
      "precipitation": 0.0,
      "windSpeed": 10,
      "score": 9,
      "isBest": true,
      "timeWindow": "9:00 AM - 6:00 PM"
    }
  ],
  "route": {
    "from": "Berlin, DE",
    "to": "Lake Tahoe, CA, US",
    "distanceKm": 9512,
    "links": {
      "driving":  "https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=driving",
      "walking":  "https://www.google.com/maps/dir/?api=1&...&travelmode=walking",
      "cycling":  "https://www.google.com/maps/dir/?api=1&...&travelmode=bicycling",
      "transit":  "https://www.google.com/maps/dir/?api=1&...&travelmode=transit",
      "apple":    "http://maps.apple.com/?saddr=...&daddr=...&dirflg=d",
      "waze":     "https://waze.com/ul?ll=...&navigate=yes"
    }
  }
}
\`\`\`

The "route" field is OPTIONAL — include it only when get_route was called successfully. If the user hasn't given their starting city yet, omit "route" entirely.

When comparing multiple locations (user asked for "best place in region X"), each entry in "allDays" MUST include a "location" field with the resolved location name (e.g. "Innsbruck, AT"). This is how the UI displays location names on each card.

Be friendly and enthusiastic. Use weather emojis naturally. Keep explanations clear and data-driven.`;

const TOOLS = [
  {
    name: 'get_weather_forecast',
    description: 'Fetches a 5-7 day weather forecast for a given location. Call this as soon as you know where the user wants to go.',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location name, e.g. "Lake Tahoe, CA", "Barcelona", "Yosemite Valley"'
        }
      },
      required: ['location']
    }
  },
  {
    name: 'get_route',
    description: 'Builds deep-link directions from the user\'s starting city to the activity destination, with a straight-line distance estimate. Call this AFTER get_weather_forecast (so the destination is resolved) AND only when the user has told you their starting city. Returns ready-to-use Google Maps / Apple Maps / Waze URLs for driving, walking, cycling, and transit.',
    input_schema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'The user\'s starting city as they provided it, e.g. "Berlin", "Munich, DE"'
        },
        destination: {
          type: 'string',
          description: 'The activity destination. Use the resolvedLocation string from get_weather_forecast (e.g. "Barcelona, ES").'
        },
        mode: {
          type: 'string',
          enum: ['driving', 'walking', 'cycling', 'transit'],
          description: 'Default mode shown to the user. The result includes deep links for ALL modes; this just sets the initial selection.'
        }
      },
      required: ['origin', 'destination']
    }
  }
];

function getWeatherIcon(condition) {
  const map = {
    Clear: '☀️', Clouds: '⛅', Rain: '🌧️', Drizzle: '🌦️',
    Thunderstorm: '⛈️', Snow: '❄️', Mist: '🌫️', Fog: '🌫️',
    Haze: '🌫️', Smoke: '🌫️', Dust: '💨', Tornado: '🌪️'
  };
  return map[condition] || '🌤️';
}

async function fetchWeather(location) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured');

  const geoRes = await axios.get(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
  );
  if (!geoRes.data?.length) throw new Error(`Location not found: "${location}"`);
  const { lat, lon, name, country } = geoRes.data[0];

  const forecastRes = await axios.get(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=56`
  );

  const dailyMap = {};
  const now = Date.now();

  for (const item of forecastRes.data.list) {
    if (item.dt * 1000 < now - 3600000) continue;
    const date = item.dt_txt.split(' ')[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { date, temps: [], conditions: [], precipMm: 0, windKmh: [], humidity: [], slots: [] };
    }
    const d = dailyMap[date];
    d.temps.push(item.main.temp);
    d.conditions.push(item.weather[0].main);
    d.precipMm += (item.rain?.['3h'] || 0) + (item.snow?.['3h'] || 0);
    d.windKmh.push(Math.round(item.wind.speed * 3.6));
    d.humidity.push(item.main.humidity);
    d.slots.push({
      time: item.dt_txt.split(' ')[1].slice(0, 5),
      temp: Math.round(item.main.temp),
      condition: item.weather[0].main,
      precip: Math.round((item.rain?.['3h'] || 0) * 10) / 10,
      wind: Math.round(item.wind.speed * 3.6)
    });
  }

  const days = Object.entries(dailyMap).slice(0, 7).map(([date, d]) => {
    const condCount = {};
    d.conditions.forEach(c => (condCount[c] = (condCount[c] || 0) + 1));
    const dominant = Object.entries(condCount).sort((a, b) => b[1] - a[1])[0][0];
    return {
      date,
      dayName: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      tempMin: Math.round(Math.min(...d.temps)),
      tempMax: Math.round(Math.max(...d.temps)),
      condition: dominant,
      icon: getWeatherIcon(dominant),
      precipMm: Math.round(d.precipMm * 10) / 10,
      avgWindKmh: Math.round(d.windKmh.reduce((a, b) => a + b, 0) / d.windKmh.length),
      avgHumidity: Math.round(d.humidity.reduce((a, b) => a + b, 0) / d.humidity.length),
      slots: d.slots
    };
  });

  return { resolvedLocation: `${name}, ${country}`, days };
}

// ── Route planner (no third-party API — geocode via OpenWeather + deep links) ──

async function geocodePlace(query) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured');
  const res = await axios.get(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
  );
  if (!res.data?.length) throw new Error(`Location not found: "${query}"`);
  const { lat, lon, name, country, state } = res.data[0];
  const label = [name, state, country].filter(Boolean).join(', ');
  return { lat, lon, label };
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const APPLE_DIRFLG = { driving: 'd', walking: 'w', cycling: 'c', transit: 'r' };
const GOOGLE_TRAVELMODE = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'bicycling',
  transit: 'transit',
};

function buildRouteLinks(from, to) {
  const origin = encodeURIComponent(from.label);
  const destination = encodeURIComponent(to.label);
  const links = {};
  for (const m of Object.keys(GOOGLE_TRAVELMODE)) {
    links[m] = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${GOOGLE_TRAVELMODE[m]}`;
  }
  links.apple = `http://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=${APPLE_DIRFLG.driving}`;
  links.appleByMode = {};
  for (const m of Object.keys(APPLE_DIRFLG)) {
    links.appleByMode[m] = `http://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=${APPLE_DIRFLG[m]}`;
  }
  links.waze = `https://waze.com/ul?ll=${to.lat}%2C${to.lon}&navigate=yes&from=${from.lat}%2C${from.lon}`;
  return links;
}

const MODE_SPEEDS_KMH = { driving: 80, cycling: 15, transit: 40, walking: 5 };

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function estimateDurations(distanceKm) {
  const result = {};
  for (const [mode, speed] of Object.entries(MODE_SPEEDS_KMH)) {
    result[mode] = formatDuration(distanceKm / speed);
  }
  return result;
}

async function planRoute(origin, destination, mode = 'driving') {
  const safeMode = GOOGLE_TRAVELMODE[mode] ? mode : 'driving';
  const [from, to] = await Promise.all([
    geocodePlace(origin),
    geocodePlace(destination),
  ]);
  const distanceKm = Math.round(haversineKm(from, to));
  return {
    from: from.label,
    to: to.label,
    fromCoords: { lat: from.lat, lon: from.lon },
    toCoords: { lat: to.lat, lon: to.lon },
    distanceKm,
    durationByMode: estimateDurations(distanceKm),
    defaultMode: safeMode,
    links: buildRouteLinks(from, to),
  };
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) return res.status(400).json({ error: 'message and sessionId required' });

    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    const history = sessions.get(sessionId);
    history.push({ role: 'user', content: message });

    let messages = [...history];

    // Agentic loop — runs until Claude stops calling tools
    while (true) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages
      });

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });
        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          let result;
          try {
            if (block.name === 'get_weather_forecast') {
              const data = await fetchWeather(block.input.location);
              result = JSON.stringify(data);
            } else if (block.name === 'get_route') {
              const { origin, destination, mode } = block.input || {};
              if (!origin || !destination) {
                result = JSON.stringify({ error: 'origin and destination are required' });
              } else {
                const data = await planRoute(origin, destination, mode);
                result = JSON.stringify(data);
              }
            } else {
              result = JSON.stringify({ error: 'Unknown tool' });
            }
          } catch (err) {
            result = JSON.stringify({ error: err.message });
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Final text response
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
      history.push({ role: 'assistant', content: response.content });
      sessions.set(sessionId, history);

      // Parse optional recommendation JSON
      let recommendation = null;
      const match = text.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.type === 'recommendation') {
            parsed.allDays = parsed.allDays.map(day => ({
              ...day,
              icon: day.icon || getWeatherIcon(day.condition)
            }));
            recommendation = parsed;
          }
        } catch (_) { /* ignore parse errors */ }
      }

      const cleanText = text.replace(/```json[\s\S]*?```/g, '').trim();
      return res.json({ message: cleanText, recommendation });
    }
  } catch (err) {
    console.error('[chat error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ics', (req, res) => {
  const { date, activity, location, timeWindow, summary } = req.body;
  if (!date || !activity) return res.status(400).json({ error: 'date and activity required' });

  const dtStart = date.replace(/-/g, '');
  const nextDay = new Date(date + 'T12:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const dtEnd = nextDay.toISOString().split('T')[0].replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const emojiMap = {
    camping: '⛺', hiking: '🥾', sunbathing: '🏖️', beach: '🏖️',
    jogging: '🏃', running: '🏃', festival: '🎉', picnic: '🧺'
  };
  const emoji = emojiMap[(activity || '').toLowerCase()] || '🌤️';

  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const activityTitle = activity.charAt(0).toUpperCase() + activity.slice(1);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Weather Activity Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `DTSTAMP:${stamp}`,
    `UID:wap-${dtStart}-${Date.now()}@weatherplanner.local`,
    `SUMMARY:${emoji} ${esc(activityTitle)} at ${esc(location || '')}`,
    `DESCRIPTION:Best weather day for ${esc(activity)}\\nTime: ${esc(timeWindow || '')}\\n\\n${esc(summary || '')}\\n\\nGenerated by Weather Activity Planner`,
    `LOCATION:${esc(location || '')}`,
    'TRANSP:TRANSPARENT',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${activity}-${date}.ics"`);
  res.send(lines.join('\r\n'));
});

// ── Firefly ──────────────────────────────────────────────────────────────────

function buildFireflyPrompt({ condition, activity, tempMax, location, isBest }) {
  // Exaggerated, over-the-top cartoon weather descriptions
  const weatherDesc = {
    Clear:        'an absolutely blinding cartoon sun dominating the sky with giant sunrays, exaggerated warm golden glow, oversized fluffy white clouds floating happily, impossibly vivid blue sky',
    Clouds:       'dramatically oversized cartoon clouds piled up like mountains, moody grey sky with exaggerated depth and texture, theatrical overcast lighting',
    Rain:         'a ridiculously dramatic cartoon rainstorm, enormous splashing raindrops the size of buckets, dark brooding storm clouds with angry faces, puddles everywhere',
    Drizzle:      'whimsical light cartoon rain with cute tiny droplets, soft pastel grey clouds, gentle misty atmosphere with exaggerated damp sparkle',
    Thunderstorm: 'an epic cartoon thunderstorm apocalypse, massive zigzag lightning bolts splitting the sky, furious purple and black storm clouds with dramatic expressions, torrential downpour',
    Snow:         'a magical cartoon blizzard with oversized snowflakes as big as dinner plates, exaggerated winter wonderland, everything buried in fluffy white snow, tiny characters bundled in scarves',
    Mist:         'mystical cartoon fog rolling in like a ghost, swirling exaggerated mist with eerie soft glow, ethereal whimsical atmosphere',
    Fog:          'impenetrable cartoon fog so thick you could cut it, dramatic mysterious grey wall of mist, comedically dense foggy landscape'
  }[condition] || 'wild and wacky cartoon weather with exaggerated atmospheric drama';

  const activityDesc = {
    camping:    'a cozy cartoon campsite with round colourful tents, a roaring campfire with exaggerated tall flames, forest of perfectly round cartoon trees',
    hiking:     'a winding cartoon mountain trail through impossibly lush green hills, exaggerated dramatic peaks, cheerful cartoon landscape',
    sunbathing: 'a cartoon beach paradise with exaggerated golden sand, giant cheerful sun, colourful umbrellas and loungers, sparkling turquoise waves',
    jogging:    'a cartoon runner on a winding park path, exaggerated motion lines, bright green cartoon trees and perfect cartoon clouds',
    running:    'a cartoon athlete dashing through a vivid illustrated landscape with exaggerated speed lines and dramatic motion',
    festival:   'a vibrant cartoon outdoor festival, exaggerated colourful stage and bunting, cartoon crowd, oversized banners and balloons',
    picnic:     'an idyllic cartoon picnic scene, checkered blanket, exaggerated food spread, perfectly round cartoon trees and bright flowers',
    beach:      'a cartoon beach paradise with exaggerated giant waves, oversized cartoon sun, colourful beach balls and umbrellas'
  }[activity?.toLowerCase()] || 'a vibrant cartoon outdoor scene with exaggerated dramatic landscape';

  const locStr  = location ? ` in ${location.split(',')[0]}` : '';
  const bestStr = isBest ? ', perfect golden hour cartoon lighting, triumphant and glorious atmosphere, hero shot composition' : '';
  return `${activityDesc}${locStr}, ${weatherDesc}, ${tempMax}°C, cartoon illustration style, bold outlines, flat vibrant colours, Studio Ghibli inspired, animated movie aesthetic, no text, no people${bestStr}`;
}

app.post('/api/firefly-image', async (req, res) => {
  const { condition, activity, tempMax, location, dayName, isBest } = req.body;
  const prompt = buildFireflyPrompt({ condition, activity, tempMax, location, isBest });
  try {
    const imageUrl = await generateImage({
      prompt,
      size: { width: 1024, height: 1024 },
      contentClass: 'art',
      numVariations: 1
    });
    res.json({ imageUrl, prompt });
  } catch (err) {
    console.error(`[firefly error] ${dayName}:`, err.message);
    res.json({ imageUrl: null, prompt, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Weather Activity Planner → http://localhost:${PORT}`);
  const missing = [];
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) missing.push('ANTHROPIC_API_KEY');
  if (!process.env.OPENWEATHER_API_KEY) missing.push('OPENWEATHER_API_KEY');
  if (missing.length) console.warn(`[warn] Missing in .env: ${missing.join(', ')}`);
});
