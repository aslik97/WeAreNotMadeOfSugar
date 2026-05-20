# Weather Activity Planner

An AI-powered outdoor activity planner that finds the best day and time window for your activity based on a 7-day weather forecast. Type naturally — Claude asks follow-up questions if needed, fetches real weather data, and recommends the optimal day with full reasoning. The best day can be exported as an `.ics` file directly to Apple Calendar, Outlook, or Google Calendar.

---

## Features

- **Natural language input** — type anything: *"I want to go camping near Lake Tahoe this week"*
- **Agentic follow-up** — Claude asks 1–2 clarifying questions if your request is too vague
- **Real 7-day forecast** — live data from OpenWeatherMap (temperature, precipitation, wind)
- **Activity-aware scoring** — each day is scored 1–10 based on ideal conditions per activity type (camping, hiking, sunbathing, jogging, festival, picnic, and more)
- **Visual forecast card** — colorful 7-day grid with weather icons, scores, and a thumbs-up on the best day
- **Best time window** — specific time range recommendation (e.g. 10:00 AM – 4:00 PM)
- **Route planner** — once the agent knows your starting city, it surfaces ready-to-tap directions to the destination in Google Maps, Apple Maps and Waze (driving / walking / cycling / transit)
- **Apple Calendar export** — one-click `.ics` download as an all-day event

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express 4 |
| AI / LLM | Anthropic Claude API (`claude-sonnet-4-6`) via tool use |
| Weather data | OpenWeatherMap — Geocoding API + 5-day/3h Forecast API |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Fonts | Google Fonts — Fredoka One, Nunito |
| Calendar export | iCalendar (`.ics`) format, generated server-side |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER  (public/)                                                  │
│                                                                      │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐  │
│  │   index.html        │      │   app.js                         │  │
│  │                     │      │                                  │  │
│  │  Left panel:        │      │  • Generates sessionId (UUID)    │  │
│  │  - Chat messages    │      │  • POST /api/chat                │  │
│  │  - Text input       │      │  • Renders 7-day forecast card   │  │
│  │  - Send button      │      │  • POST /api/ics (download)      │  │
│  │                     │      │                                  │  │
│  │  Right panel:       │      └──────────────────────────────────┘  │
│  │  - Forecast card    │                                             │
│  │  - ICS download btn │      styles.css — pink/yellow theme        │
│  └─────────────────────┘                                             │
└────────────────────────────────────┬─────────────────────────────────┘
                                     │ HTTP fetch
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  EXPRESS SERVER  (server.js)                                         │
│                                                                      │
│  POST /api/chat                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AGENTIC LOOP                                                │   │
│  │                                                              │   │
│  │  1. Append user message to session history                   │   │
│  │  2. Call Claude API (claude-sonnet-4-6) with tool definition │   │
│  │          │                                                   │   │
│  │    stop_reason == "tool_use"?                                │   │
│  │          │ YES                        NO                     │   │
│  │          ▼                             ▼                     │   │
│  │  Fetch OpenWeatherMap            Return final text           │   │
│  │  (geocode → forecast)            + JSON recommendation       │   │
│  │  Return result to Claude                                     │   │
│  │          │                                                   │   │
│  │          └──────── loop until final response ────────────── │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  3. Parse ```json recommendation block from Claude's response        │
│  4. Return { message, recommendation } to browser                   │
│                                                                      │
│  POST /api/ics                                                       │
│  → Generate RFC 5545 iCalendar file (all-day VEVENT)                │
│  → Stream as text/calendar download                                  │
└──────────┬──────────────────────────────────┬────────────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌────────────────────────────────────┐
│  ANTHROPIC API      │          │  OPENWEATHERMAP API                │
│                     │          │                                    │
│  Model:             │          │  Step 1 — Geocoding                │
│  claude-sonnet-4-6  │          │  GET /geo/1.0/direct               │
│                     │          │  "Lake Tahoe" → { lat, lon }       │
│  Tool:              │          │                                    │
│  get_weather_       │          │  Step 2 — Forecast                 │
│  forecast(location) │          │  GET /data/2.5/forecast            │
│                     │          │  5-day / 3h intervals (cnt=56)     │
│  System prompt:     │          │  Aggregated server-side to:        │
│  - Follow-up if     │          │  • min/max temp per day            │
│    vague            │          │  • dominant weather condition      │
│  - Score 1-10       │          │  • total precipitation             │
│  - Return JSON rec  │          │  • average wind speed              │
└─────────────────────┘          └────────────────────────────────────┘
```

---

## Data Flow — Step by Step

```
1. User types:  "I want to go camping near Lake Tahoe this week"
                      │
                      ▼
2. POST /api/chat  →  server appends to session history
                      │
                      ▼
3. Claude receives message
   → Has activity + location? YES
   → Calls tool: get_weather_forecast("Lake Tahoe")
                      │
                      ▼
4. Server calls OpenWeatherMap:
   a. Geocode "Lake Tahoe" → lat: 38.93, lon: -119.98
   b. Fetch 5-day forecast (56 × 3h slots)
   c. Aggregate into daily summaries (temp, condition, precip, wind)
   d. Return JSON to Claude
                      │
                      ▼
5. Claude analyses each day for camping suitability
   → Scores each day 1-10
   → Picks best day + optimal time window
   → Writes reasoning + appends JSON recommendation block
                      │
                      ▼
6. Server parses JSON block, strips it from display text
   → Returns { message: "...", recommendation: { allDays, bestDay } }
                      │
                      ▼
7. Browser renders:
   → Chat bubble with Claude's reasoning
   → Colorful 7-day forecast grid
   → Thumbs up on best day
   → "Add to Apple Calendar" button
                      │
                      ▼
8. User clicks "Add to Apple Calendar"
   → POST /api/ics
   → Server generates RFC 5545 .ics file (all-day VEVENT)
   → Browser downloads → macOS opens in Calendar.app
```

---

## Project Structure

```
Weather_App/
├── server.js              Express server — routing, agentic loop,
│                          weather fetch, ICS generation
├── public/
│   ├── index.html         Two-panel layout (chat + forecast card)
│   ├── styles.css         Visual design — pink/yellow theme,
│   │                      7-day grid, animations
│   └── app.js             Chat logic, forecast card renderer,
│                          ICS download handler
├── .env                   API keys (gitignored)
├── .env.example           Safe template for new contributors
├── package.json
└── .gitignore
```

---

## Prerequisites

- **Node.js** v18 or higher
- **OpenWeatherMap API key** — free tier at [openweathermap.org](https://openweathermap.org/api)
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/your-username/weather-activity-planner.git
cd weather-activity-planner
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the root directory:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENWEATHER_API_KEY=your_openweather_key
PORT=3001
```

**4. Run the development server**

```bash
npm run dev
```

Open **http://localhost:3001** in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap API key (free tier works) |
| `PORT` | No | Server port (default: 3001) |

---

## API Endpoints

### `POST /api/chat`

Sends a user message and returns Claude's response + optional weather recommendation.

**Request body:**
```json
{
  "message": "I want to go hiking near Barcelona this week",
  "sessionId": "uuid-string"
}
```

**Response:**
```json
{
  "message": "Great choice! Here's what the forecast looks like...",
  "recommendation": {
    "type": "recommendation",
    "activity": "hiking",
    "location": "Barcelona, ES",
    "bestDay": {
      "date": "2024-05-21",
      "dayName": "Tuesday",
      "timeWindow": "8:00 AM - 1:00 PM",
      "score": 9,
      "summary": "Clear skies, 19°C, light breeze — perfect hiking conditions"
    },
    "allDays": [...]
  }
}
```

> `recommendation` is `null` when Claude is still asking follow-up questions.

When the user has also provided their starting city, the recommendation includes a `route` block:

```json
"route": {
  "from": "Berlin, DE",
  "to": "Barcelona, ES",
  "distanceKm": 1497,
  "defaultMode": "driving",
  "links": {
    "driving":  "https://www.google.com/maps/dir/?api=1&...&travelmode=driving",
    "walking":  "https://www.google.com/maps/dir/?api=1&...&travelmode=walking",
    "cycling":  "https://www.google.com/maps/dir/?api=1&...&travelmode=bicycling",
    "transit":  "https://www.google.com/maps/dir/?api=1&...&travelmode=transit",
    "apple":    "http://maps.apple.com/?saddr=Berlin&daddr=Barcelona&dirflg=d",
    "appleByMode": { "driving": "...", "walking": "...", "cycling": "...", "transit": "..." },
    "waze":     "https://waze.com/ul?ll=...&navigate=yes&from=..."
  }
}
```

Distance is **straight-line (Haversine)** based on geocoded coordinates — there is no third-party routing API. All actual navigation happens inside Google Maps / Apple Maps / Waze via deep links.

---

### `POST /api/ics`

Generates and downloads an iCalendar `.ics` file for the recommended day.

**Request body:**
```json
{
  "date": "2024-05-21",
  "activity": "hiking",
  "location": "Barcelona, ES",
  "timeWindow": "8:00 AM - 1:00 PM",
  "summary": "Clear skies, 19°C, perfect hiking conditions"
}
```

**Response:** `text/calendar` file download

---

## Activity Scoring Criteria

| Activity | Ideal Temp | Max Precip | Max Wind | Key Condition |
|---|---|---|---|---|
| Camping | 8–25°C | < 2mm | < 30 km/h | No thunderstorms |
| Hiking | 5–22°C | < 1mm | < 25 km/h | Clear / partly cloudy |
| Sunbathing | 22°C+ | < 0.5mm | any | Clear skies |
| Jogging | 8–18°C | < 2mm | < 25 km/h | Any |
| Festival / Picnic | 15–28°C | 0mm | < 20 km/h | No rain |

---

## How the Agentic Loop Works

Claude uses **tool use** (function calling) to fetch weather data and build the route mid-conversation:

1. Claude receives the user's message and conversation history
2. If it has enough info, it calls `get_weather_forecast(location)`
3. The server fetches live data from OpenWeatherMap and returns it to Claude
4. Claude analyses the 7-day data against activity-specific criteria
5. Once the destination is known, Claude asks **once**: *"Where are you starting from?"*
6. When the user provides their origin, Claude calls `get_route(origin, destination)` — the server geocodes both endpoints, computes the straight-line distance, and returns deep links for all four transport modes
7. Claude returns a conversational response **plus** a structured JSON block (forecast + optional `route`)
8. The server parses the JSON to render the visual card and route panel; the clean text goes into the chat

If the user's request is too vague (e.g. just *"I want to go outside"*), Claude asks up to 2 clarifying questions before calling the weather tool.

---

## Screenshots

> Chat interface with 7-day forecast card and Apple Calendar export

*(Add screenshots here after first run)*

---

## License

MIT
