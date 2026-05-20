# Product Requirements Document (PRD)
## Weather Activity Planner

| Field | Detail |
|---|---|
| **Product Name** | Weather Activity Planner |
| **Author** | Asli Kullelioglu |
| **Status** | v1.0 — In Development |
| **Last Updated** | May 2026 |
| **Platform** | Web (local, Node.js) |

---

## 1. Overview

### 1.1 Product Summary

Weather Activity Planner is an AI-powered web application that helps users find the best day and time window for outdoor activities based on real-time 7-day weather forecasts. Users interact through a natural language chat interface powered by Claude (Anthropic). The app analyses weather data per activity type, scores each day 1–10, and surfaces a single best recommendation — complete with a Firefly-generated cartoon illustration, an exportable Apple Calendar invite, and full reasoning.

### 1.2 Problem Statement

Planning outdoor activities around weather is time-consuming and fragmented. Users typically check weather apps manually, interpret raw data themselves, and have no smart guidance on which specific day or time window is ideal for their activity. Generic weather apps do not account for activity-specific conditions (e.g. hiking vs. sunbathing have different optimal temperature and wind ranges).

### 1.3 Solution

A conversational AI agent (Claude) that:
1. Understands natural language activity requests
2. Asks clarifying questions when the request is too vague
3. Fetches live weather data automatically
4. Scores every available day per activity-specific criteria
5. Recommends the single best day with a specific time window and clear reasoning
6. Visualises the 7-day forecast in a colourful card with AI-generated cartoon imagery
7. Exports the recommendation to Apple Calendar as a one-click `.ics` download

---

## 2. Goals & Success Metrics

### 2.1 Goals

| Goal | Description |
|---|---|
| **Reduce planning effort** | User gets a clear recommendation in under 30 seconds |
| **Activity-aware advice** | Recommendations account for activity-specific weather thresholds |
| **Honest data scope** | System never fabricates forecasts — clearly communicates when data is unavailable (beyond 7 days) |
| **Delight** | Cartoon Firefly images make the forecast card engaging and shareable |
| **Calendar integration** | Best day recommendation flows directly into the user's calendar |

### 2.2 Success Metrics (v1)

- User receives a valid recommendation on first or second message in ≥ 80% of interactions
- Firefly image generates successfully for the best day in ≥ 90% of recommendations
- `.ics` download works correctly across Apple Calendar, Outlook, and Google Calendar
- Claude correctly declines out-of-range requests (> 7 days) 100% of the time

---

## 3. Users & Use Cases

### 3.1 Primary User

- **Outdoor enthusiast** — someone planning a specific activity (hike, camp, jog, picnic, festival, sunbathing) within the next week and wants data-driven timing advice
- Non-technical, expects conversational UX similar to ChatGPT
- Uses a Mac with Apple Calendar

### 3.2 Core Use Cases

| ID | Use Case | Description |
|---|---|---|
| UC-01 | Plan a hike this week | User asks "I want to hike near Barcelona this week" → gets scored 7-day forecast + best day + .ics |
| UC-02 | Plan camping for the weekend | User asks vaguely → Claude asks location → scores weekend days → recommends Saturday or Sunday |
| UC-03 | Ask about next month | User asks for next month → Claude explains data unavailability, asks to rephrase for this week |
| UC-04 | Today's weather decision | "Should I jog today in Berlin?" → Claude analyses today's slots and gives a time window |
| UC-05 | Festival planning | "Best day for an outdoor festival in London this week?" → full forecast card + calendar export |
| UC-06 | Vague activity | "I want to do something outside" → Claude asks what activity and where before fetching data |

---

## 4. Features & Requirements

### 4.1 Conversational AI (Claude)

| ID | Requirement | Priority |
|---|---|---|
| F-01 | Accept natural language input for any outdoor activity | Must Have |
| F-02 | Ask 1–2 clarifying questions when activity or location is missing/vague | Must Have |
| F-03 | Never ask more than 2 questions at once | Must Have |
| F-04 | Detect time range in user query (today / this week / next week / next month) | Must Have |
| F-05 | Decline requests > 7 days ahead with a clear explanation and redirect | Must Have |
| F-06 | Maintain full conversation history within a session | Must Have |
| F-07 | Render Claude's responses as formatted markdown in the chat | Must Have |
| F-08 | Support activities: camping, hiking, sunbathing, jogging, running, festival, picnic, beach | Must Have |
| F-09 | Use today's actual date in reasoning (injected dynamically into system prompt) | Must Have |

### 4.2 Weather Data

| ID | Requirement | Priority |
|---|---|---|
| F-10 | Fetch live 5–7 day forecast from OpenWeatherMap | Must Have |
| F-11 | Geocode location name to lat/lon before fetching forecast | Must Have |
| F-12 | Aggregate 3-hour slots into daily summaries (min/max temp, dominant condition, total precip, avg wind) | Must Have |
| F-13 | Pass daily summaries to Claude as tool result for analysis | Must Have |
| F-14 | Handle location-not-found errors gracefully | Must Have |

#### Activity Scoring Thresholds

| Activity | Ideal Temp | Max Precip | Max Wind | Special |
|---|---|---|---|---|
| Camping | 8–25°C | < 2mm | < 30 km/h | No thunderstorms |
| Hiking | 5–22°C | < 1mm | < 25 km/h | Clear / partly cloudy |
| Sunbathing / Beach | 22°C+ | < 0.5mm | any | Clear skies |
| Jogging / Running | 8–18°C | < 2mm | < 25 km/h | — |
| Festival / Picnic | 15–28°C | 0mm | < 20 km/h | — |

### 4.3 Forecast Card UI

| ID | Requirement | Priority |
|---|---|---|
| F-15 | Display a 7-day forecast grid after a recommendation is made | Must Have |
| F-16 | Each day column shows: day name, date (e.g. May 20), weather icon, temp range, precipitation, wind, score | Must Have |
| F-17 | Best day is visually highlighted (gold border, thumbs up 👍) | Must Have |
| F-18 | Only the best day shows the thumbs up — determined by date match, not Claude's `isBest` field | Must Have |
| F-19 | Best day shows recommended time window | Must Have |
| F-20 | Non-best day cards show a weather-condition colour gradient as background | Must Have |
| F-21 | Best callout bar shows: best day name, time window, one-line summary | Must Have |
| F-22 | Logo ("Weather / Planner") appears only once — in the chat panel header | Must Have |

### 4.4 Adobe Firefly Image Generation

| ID | Requirement | Priority |
|---|---|---|
| F-23 | Generate exactly **1 cartoon image** per recommendation — for the best day only | Must Have |
| F-24 | Use Firefly Image Model 3 via `/v3/images/generate-async` endpoint | Must Have |
| F-25 | Use `contentClass: 'art'` for cartoon / illustrated output | Must Have |
| F-26 | Prompts are activity-aware and weather-condition-aware, exaggerated and over-the-top in style | Must Have |
| F-27 | Prompt style: cartoon illustration, bold outlines, flat vibrant colours, Studio Ghibli inspired | Must Have |
| F-28 | Best day card shows shimmer skeleton while image loads | Must Have |
| F-29 | On Firefly failure, best day card falls back to weather emoji — no crash | Must Have |
| F-30 | Generated prompt is visible in a collapsible "View Firefly AI prompts" section | Should Have |

### 4.5 Route Planner

| ID | Requirement | Priority |
|---|---|---|
| F-R1 | Once the activity destination is known, Claude asks the user — exactly once — where they are starting from | Must Have |
| F-R2 | Claude calls a `get_route` tool with `origin`, `destination` (the resolvedLocation from `get_weather_forecast`), and a default `mode` (`driving`) | Must Have |
| F-R3 | The server geocodes both endpoints via OpenWeather's `/geo/1.0/direct` and computes a Haversine straight-line distance in km | Must Have |
| F-R4 | The server returns ready-to-tap deep links for Google Maps (driving / walking / cycling / transit), Apple Maps (per mode + a default driving link), and Waze (driving only) | Must Have |
| F-R5 | The recommendation JSON includes an optional `route` block; the UI renders a route panel above the calendar bar only when `route` is present | Must Have |
| F-R6 | The route panel shows: origin → destination labels, straight-line distance with a "(straight-line)" honesty note, mode toggle (drive / walk / cycle / transit), and deep-link buttons that update with the selected mode | Must Have |
| F-R7 | Waze button is shown only when the active mode is `driving` (Waze is driving-only) | Must Have |
| F-R8 | No third-party routing API is called — distance is straight-line, all navigation happens in the user's installed Maps app via deep links | Must Have |
| F-R9 | If the user has not yet provided an origin, the `route` block is omitted entirely (never fabricated) | Must Have |

### 4.6 Calendar Export

| ID | Requirement | Priority |
|---|---|---|
| F-31 | "Add to Apple Calendar" button downloads an `.ics` file | Must Have |
| F-32 | Event is an all-day event (`DTSTART;VALUE=DATE`) | Must Have |
| F-33 | Event includes: activity emoji + name, location, time window, AI summary in description | Must Have |
| F-34 | `.ics` is compatible with Apple Calendar, Google Calendar, and Outlook | Must Have |
| F-35 | ICS special characters (commas, semicolons, newlines) are correctly escaped per RFC 5545 | Must Have |

### 4.7 General UX

| ID | Requirement | Priority |
|---|---|---|
| F-36 | Two-panel layout: chat on left (fixed), forecast card on right (scrollable) | Must Have |
| F-37 | Chat input supports Enter to send, Shift+Enter for new line | Must Have |
| F-38 | Textarea auto-resizes up to 120px | Should Have |
| F-39 | Typing indicator (animated dots) shown while waiting for Claude | Must Have |
| F-40 | Responsive layout — stacks vertically on screens < 860px | Should Have |
| F-41 | Google Fonts: Fredoka One (titles), Nunito (body) | Should Have |

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Server | Express 4 |
| AI / LLM | Anthropic Claude API — `claude-sonnet-4-6` |
| Weather | OpenWeatherMap — Geocoding API + 5-day/3h Forecast API (free tier) |
| Image Generation | Adobe Firefly Services — Image Model 3 (`/v3/images/generate-async`) |
| Adobe Auth | Adobe IMS — `client_credentials` grant with token caching |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Markdown | marked.js (CDN) |
| Fonts | Google Fonts CDN |
| Calendar | RFC 5545 iCalendar — server-side string generation |

### 5.2 Key Files

```
Weather_App/
├── server.js              Express server, Claude agentic loop, weather fetch,
│                          Firefly endpoint, ICS generation
├── src/
│   ├── config.js          Env var loading and validation
│   ├── auth/
│   │   └── adobeAuth.js   Adobe IMS token cache (client_credentials)
│   └── services/
│       └── fireflyService.js  Firefly async job submit + polling
├── public/
│   ├── index.html         Two-panel layout shell + marked.js CDN
│   ├── styles.css         Design system — pink/yellow theme, grid, animations
│   └── app.js             Chat logic, forecast card renderer, Firefly trigger,
│                          ICS download
├── .env                   API keys (gitignored)
├── .env.example           Safe key template for contributors
├── package.json           Dependencies + nodemon config (watches .env)
└── .gitignore
```

### 5.3 Agentic Loop Flow

```
User message
    → POST /api/chat { message, sessionId }
    → Append to session history (in-memory Map)
    → Claude API call (claude-sonnet-4-6, tool: get_weather_forecast)
         │
    stop_reason == "tool_use"?
         │ YES                          NO
         ▼                              ▼
    Fetch OpenWeatherMap          Parse JSON recommendation
    (geocode → 5-7 day forecast)  Strip JSON from display text
    Return daily summaries        Return { message, recommendation }
    to Claude → loop again
         │
    Browser renders:
    → Chat bubble (markdown)
    → 7-day forecast grid
    → POST /api/firefly-image (best day only)
    → Shimmer → cartoon image
    → .ics download button
```

### 5.4 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API — console.anthropic.com |
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap — openweathermap.org/api |
| `ADOBE_CLIENT_ID` | Yes | Adobe Developer Console |
| `ADOBE_CLIENT_SECRET` | Yes | Adobe Developer Console |
| `ADOBE_IMS_URL` | Yes | `https://ims-na1.adobelogin.com` |
| `ADOBE_FIREFLY_API_URL` | Yes | `https://firefly-api.adobe.io` |
| `PORT` | No | Default: 3001 |

---

## 6. Out of Scope (v1)

| Item | Reason |
|---|---|
| Weather forecasts beyond 7 days | OpenWeatherMap free tier limitation |
| User accounts / authentication | Local single-user app |
| Persistent conversation history across sessions | In-memory only |
| Push notifications or reminders | Out of scope for v1 |
| Mobile native app | Web only |
| Multi-language support | English only in v1 |
| Historical weather data | Not relevant for activity planning |
| Multiple location comparison | Single location per query |
| Hourly granularity in the UI | Daily summary is sufficient |

---

## 7. Constraints & Risks

| Constraint / Risk | Mitigation |
|---|---|
| OpenWeatherMap free tier: 5-day limit | System prompt explicitly blocks requests > 7 days and redirects user |
| Firefly image generation: ~5–15s latency | Shimmer skeleton shown immediately; image appears when ready |
| Firefly API credits / quota | Only 1 image generated per recommendation (best day only) |
| Claude API cost | Session history capped per conversation; no background polling |
| Adobe IMS token expiry | `adobeAuth.js` caches token and refreshes 60s before expiry |
| `.env` changes not picked up without restart | nodemon config watches `.env` file for changes |

---

## 8. Future Considerations (v2+)

- **Extended forecast**: Integrate a paid weather API (e.g. OpenWeatherMap One Call 3.0, Tomorrow.io) for 14-day forecasts
- **Multi-day trip planning**: Recommend a consecutive block of good days for a multi-day camping trip
- **Location autocomplete**: Typeahead suggestions as user types a location in chat
- **Shareable forecast card**: Export the forecast card as a PNG or share link
- **Push reminders**: Notify the user the day before their saved event if weather changes
- **Mobile responsive polish**: Full mobile-first redesign for v2
- **Activity presets**: Quick-tap buttons for common activities (🥾 Hike, ⛺ Camp, 🏖️ Beach)
- **Multiple recommendations**: Compare two locations side by side

---

## 9. Glossary

| Term | Definition |
|---|---|
| **WeatherBuddy** | The Claude AI persona used in the system prompt |
| **Agentic loop** | The server-side loop that handles Claude's tool calls before returning a final response |
| **Tool use** | Anthropic's function-calling feature — Claude requests `get_weather_forecast`, server executes it and returns the result |
| **Best day** | The single day with the highest activity score selected by Claude |
| **ICS / iCalendar** | RFC 5545 calendar file format supported by Apple Calendar, Google Calendar, and Outlook |
| **Firefly** | Adobe Firefly Services — generative image AI, Image Model 3 |
| **contentClass: art** | Firefly parameter that produces illustrated/artistic output instead of photorealistic |
| **Daily summary** | Server-side aggregation of 3-hour OpenWeatherMap slots into min/max temp, dominant condition, total precipitation, average wind |
