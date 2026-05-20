(() => {
  let sessionId = crypto.randomUUID();
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const forecastSection = document.getElementById('forecast-section');
  const appEl = document.querySelector('.app');
  const newSearchBtn = document.getElementById('new-search-btn');
  let hasExpanded = false;

  // ── New search: reset everything ─────────────────────────────────
  function resetToStart() {
    // New session
    sessionId = crypto.randomUUID();
    hasExpanded = false;

    // Slide chat back to center
    appEl.classList.remove('expanded');

    // Clear messages, restore welcome bubble
    messagesEl.innerHTML = `
      <div class="message assistant">
        <div class="msg-bubble">
          Hi! I'm your weather planning buddy! 🌤️<br><br>
          Tell me what outdoor activity you're planning — camping, hiking, sunbathing, jogging, a festival, picnic... anything! Just mention where and roughly when, and I'll find your best weather window this week.
        </div>
      </div>`;

    // Clear forecast panel
    forecastSection.innerHTML = `
      <div class="forecast-placeholder" id="forecast-placeholder">
        <div class="placeholder-icons">☀️ ⛅ 🌧️ ⛈️</div>
        <p>Your personalized weather forecast<br>will appear here after you chat!</p>
      </div>`;

    // Hide button again
    newSearchBtn.classList.add('hidden');
    inputEl.value = '';
    inputEl.style.height = 'auto';
    inputEl.focus();
  }

  newSearchBtn.addEventListener('click', resetToStart);

  // Configure marked for safe inline rendering
  marked.use({ breaks: true, gfm: true });

  // ── Helpers ──────────────────────────────────────────────────────
  function appendMessage(role, html, isMarkdown = false) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = isMarkdown ? marked.parse(html) : html;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'message assistant typing';
    wrap.innerHTML = '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function scoreClass(score) {
    if (score >= 7) return 's-high';
    if (score >= 4) return 's-mid';
    return 's-low';
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function formatShortDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function conditionGradient(condition) {
    const map = {
      Clear:        'linear-gradient(135deg,#FFE082,#FFB300)',
      Clouds:       'linear-gradient(135deg,#CFD8DC,#90A4AE)',
      Rain:         'linear-gradient(135deg,#90CAF9,#1565C0)',
      Drizzle:      'linear-gradient(135deg,#B3E5FC,#0288D1)',
      Thunderstorm: 'linear-gradient(135deg,#7E57C2,#1A237E)',
      Snow:         'linear-gradient(135deg,#E3F2FD,#90CAF9)',
      Mist:         'linear-gradient(135deg,#ECEFF1,#B0BEC5)',
      Fog:          'linear-gradient(135deg,#ECEFF1,#B0BEC5)',
    };
    return map[condition] || 'linear-gradient(135deg,#E8EAF6,#9FA8DA)';
  }

  // ── Render forecast card ──────────────────────────────────────────
  function renderForecast(rec) {
    // Match best day by location too (multi-location mode has identical dates)
    function isBestDay(d) {
      if (d.date !== rec.bestDay.date) return false;
      if (rec.bestDay.location && d.location) return d.location === rec.bestDay.location;
      return true;
    }

    const dayCells = rec.allDays.map((d, i) => {
      const isBest = isBestDay(d);
      if (isBest) {
        return `
          <div class="day-card best">
            <div class="best-crown">✨ Best</div>
            <div class="day-label">${escapeHtml(d.dayName.slice(0,3))}<span class="day-label-date">${escapeHtml(formatShortDate(d.date))}</span>${d.location ? `<span class="day-label-loc">${escapeHtml(d.location)}</span>` : ''}</div>
            <div class="day-img-wrap" id="day-img-wrap-${i}"><div class="day-img-skeleton"></div></div>
            <div class="day-temps"><span class="hi">${d.tempMax}°</span><span class="sep">/</span><span class="lo">${d.tempMin}°</span></div>
            <div class="day-details">💧 ${d.precipitation}mm &nbsp;·&nbsp; 💨 ${d.windSpeed}km/h</div>
            <div class="day-score ${scoreClass(d.score)}">${d.score}/10</div>
            ${d.timeWindow ? `<div class="day-window">${escapeHtml(d.timeWindow)}</div>` : ''}
          </div>`;
      }
      return `
        <div class="day-card">
          <div class="day-label">${escapeHtml(d.dayName.slice(0,3))}<span class="day-label-date">${escapeHtml(formatShortDate(d.date))}</span>${d.location ? `<span class="day-label-loc">${escapeHtml(d.location)}</span>` : ''}</div>
          <div class="day-emoji-big">${d.icon || '🌤️'}</div>
          <div class="day-temps"><span class="hi">${d.tempMax}°</span><span class="sep">/</span><span class="lo">${d.tempMin}°</span></div>
          <div class="day-details">💧 ${d.precipitation}mm &nbsp;·&nbsp; 💨 ${d.windSpeed}km/h</div>
          <div class="day-score ${scoreClass(d.score)}">${d.score}/10</div>
        </div>`;
    }).join('');

    forecastSection.innerHTML = `
      <div class="forecast-card">
        <div class="fc-meta">
          <span class="fc-meta-tag">🎯 ${escapeHtml(rec.activity.charAt(0).toUpperCase() + rec.activity.slice(1))}</span>
          <span class="fc-meta-tag">📍 ${escapeHtml(rec.location || rec.bestDay.location || 'Multiple locations')}</span>
        </div>

        <div class="days-row">${dayCells}</div>

        <div class="best-callout">
          <span class="best-badge">🏆 ${escapeHtml(rec.bestDay.dayName)}</span>
          <span class="best-text">${escapeHtml(rec.bestDay.timeWindow)} &nbsp;·&nbsp; ${escapeHtml(rec.bestDay.summary)}</span>
        </div>

        ${renderRouteBlock(rec.route)}

        <div class="ics-bar">
          <button class="ics-btn" id="ics-btn">📅 Add to Calendar</button>
          <span class="ics-note">Works with Apple, Outlook &amp; Google</span>
        </div>

        <div class="prompts-section">
          <details>
            <summary>View Firefly AI prompts used for images</summary>
            <div class="prompts-list" id="prompts-list">
              <div class="prompt-item"><div class="prompt-text">Generating images…</div></div>
            </div>
          </details>
        </div>
      </div>`;

    // ICS handler
    document.getElementById('ics-btn').addEventListener('click', async () => {
      const btn = document.getElementById('ics-btn');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      try {
        const res = await fetch('/api/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: rec.bestDay.date,
            activity: rec.activity,
            location: rec.location,
            timeWindow: rec.bestDay.timeWindow,
            summary: rec.bestDay.summary
          })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${rec.activity}-${rec.bestDay.date}.ics`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('Could not generate calendar event: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '📅 Add to Apple Calendar';
      }
    });

    forecastSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Kick off Firefly image generation for all days in parallel
    generateFireflyImages(rec);

    // Wire up the route panel mode toggle + deep links (if present)
    wireRoutePanel(rec.route);
  }

  // ── Route panel ───────────────────────────────────────────────────
  function renderRouteBlock(route) {
    if (!route || !route.links) return '';
    const distance = typeof route.distanceKm === 'number'
      ? `≈ ${route.distanceKm.toLocaleString('en-US')} km <span class="route-note">(straight-line)</span>`
      : '';
    const initialMode = route.defaultMode || 'driving';
    const MODES = [
      { id: 'driving', label: '🚗 Drive' },
      { id: 'walking', label: '🚶 Walk' },
      { id: 'cycling', label: '🚴 Cycle' },
      { id: 'transit', label: '🚌 Transit' },
    ];
    const modeBtns = MODES.map(m => `
      <button class="route-mode${m.id === initialMode ? ' active' : ''}"
              data-mode="${m.id}" type="button">${m.label}</button>
    `).join('');
    return `
      <div class="route-bar" id="route-bar" data-mode="${initialMode}">
        <div class="route-head">
          <span class="route-icon">🧭</span>
          <span class="route-title">Route</span>
        </div>
        <div class="route-line">
          <span class="route-from">📍 ${escapeHtml(route.from || '')}</span>
          <span class="route-arrow">→</span>
          <span class="route-to">🏁 ${escapeHtml(route.to || '')}</span>
        </div>
        <div class="route-distance-row">
          <span class="route-distance">${distance}</span>
          <span class="route-duration" id="route-duration"></span>
        </div>
        <div class="route-modes">${modeBtns}</div>
        <div class="route-links" id="route-links"></div>
        <div class="route-spotify" id="route-spotify"></div>
      </div>
    `;
  }

  function wireRoutePanel(route) {
    if (!route || !route.links) return;
    const bar = document.getElementById('route-bar');
    if (!bar) return;

    function paintLinks(mode) {
      const links = route.links;
      const apple = (links.appleByMode && links.appleByMode[mode]) || links.apple;
      const buttons = [
        { href: links[mode], label: 'Open in Google Maps' },
        { href: apple,       label: 'Open in Apple Maps' },
      ];
      if (mode === 'driving' && links.waze) {
        buttons.push({ href: links.waze, label: 'Open in Waze' });
      }
      document.getElementById('route-links').innerHTML = buttons
        .filter(b => b.href)
        .map(b => `<a class="route-link" href="${b.href}" target="_blank" rel="noopener">${b.label}</a>`)
        .join('');
    }

    function paintDuration(mode) {
      const el = document.getElementById('route-duration');
      if (!el) return;
      const dur = route.durationByMode && route.durationByMode[mode];
      el.textContent = dur ? `· ⏱ ${dur}` : '';
    }

    function paintSpotify(mode) {
      const el = document.getElementById('route-spotify');
      if (!el) return;
      if (mode === 'driving') {
        el.innerHTML = `<a class="spotify-btn" href="https://open.spotify.com/search/driving%20mix/playlists" target="_blank" rel="noopener">🎵 Open a Driving Mix on Spotify</a>`;
      } else {
        el.innerHTML = '';
      }
    }

    const initialMode = route.defaultMode || 'driving';
    paintLinks(initialMode);
    paintDuration(initialMode);
    paintSpotify(initialMode);

    bar.querySelectorAll('.route-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        bar.querySelectorAll('.route-mode').forEach(b => b.classList.toggle('active', b === btn));
        bar.setAttribute('data-mode', mode);
        paintLinks(mode);
        paintDuration(mode);
        paintSpotify(mode);
      });
    });
  }

  // ── Firefly image — best day only ───────────────────────────────
  async function generateFireflyImages(rec) {
    const bestIndex = rec.allDays.findIndex(d => {
      if (d.date !== rec.bestDay.date) return false;
      if (rec.bestDay.location && d.location) return d.location === rec.bestDay.location;
      return true;
    });
    const day = rec.allDays[bestIndex];
    if (!day) return;

    let result = null;
    try {
      const data = await fetch('/api/firefly-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition: day.condition,
          activity:  rec.activity,
          tempMax:   day.tempMax,
          location:  rec.location,
          dayName:   day.dayName,
          isBest:    true
        })
      }).then(r => r.json());

      const wrap = document.getElementById(`day-img-wrap-${bestIndex}`);
      if (wrap) {
        if (data.imageUrl) {
          const img = document.createElement('img');
          img.className = 'day-img';
          img.src = data.imageUrl;
          img.alt = day.dayName;
          img.onload  = () => { wrap.innerHTML = ''; wrap.appendChild(img); };
          img.onerror = () => showImageError(wrap, day.icon);
        } else {
          showImageError(wrap, day.icon);
        }
      }
      result = { day, prompt: data.prompt, error: data.error };
    } catch {
      const wrap = document.getElementById(`day-img-wrap-${bestIndex}`);
      if (wrap) showImageError(wrap, day.icon);
      result = { day, prompt: null, error: 'Failed' };
    }

    renderPromptsList(result ? [result] : []);
  }

  function showImageError(wrap, icon) {
    wrap.innerHTML = `<div class="day-img-error">${icon || '🌤️'}</div>`;
  }

  function renderPromptsList(results) {
    const list = document.getElementById('prompts-list');
    if (!list) return;
    const items = results.filter(Boolean).map(r => `
      <div class="prompt-item">
        <div class="prompt-day">Best day · ${escapeHtml(r.day.dayName)} · ${escapeHtml(r.day.condition)} ${r.day.icon || ''}</div>
        <div class="prompt-text">${r.error ? `⚠️ ${escapeHtml(r.error)}` : escapeHtml(r.prompt || '')}</div>
      </div>`);
    list.innerHTML = items.join('') || '<div class="prompt-item"><div class="prompt-text">No prompt available.</div></div>';
  }

  // ── Send message ──────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // First message triggers layout expansion + reveals new-search button
    if (!hasExpanded) {
      hasExpanded = true;
      appEl.classList.add('expanded');
      newSearchBtn.classList.remove('hidden');
    }

    // User message — escape HTML (not markdown)
    appendMessage('user', escapeHtml(text).replace(/\n/g, '<br>'));
    const typingEl = showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId })
      });
      typingEl.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        appendMessage('assistant', escapeHtml(err.error || String(res.status)));
        return;
      }

      const data = await res.json();

      // Claude's reply — render as markdown
      if (data.message) appendMessage('assistant', data.message, true);

      if (data.recommendation) renderForecast(data.recommendation);

    } catch (err) {
      typingEl.remove();
      appendMessage('assistant', `Connection error: ${escapeHtml(err.message)}`);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Event listeners ───────────────────────────────────────────────
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });
})();
