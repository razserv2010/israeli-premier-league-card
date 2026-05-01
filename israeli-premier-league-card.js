class IsraeliPremierLeagueCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._recentEvents = new Map();
    this._eventSubscriptions = [];
    this._lastFixturesJson = null;
    this._initialized = false;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("יש להגדיר entity");
    this._config = config;
    this._lastFixturesJson = null;
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._subscribed) {
      this._subscribeToEvents();
      this._subscribed = true;
    }
    const stateObj = hass.states[this._config?.entity];
    const fixturesJson = JSON.stringify(stateObj?.attributes?.fixtures || []);
    if (fixturesJson === this._lastFixturesJson && this._initialized) return;
    this._lastFixturesJson = fixturesJson;
    this._render();
  }

  getCardSize() { return 3; }

  static getConfigElement() {
    return document.createElement("israeli-premier-league-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "sensor.lygt_h_l_mshkhqym_qrvbym",
      title: "ליגת העל",
      max_events_visible: 5,
      max_events_total: 20,
      show_finished_matches: true,
      show_channels: true,
      hide_header: false,
    };
  }

  _subscribeToEvents() {
    if (!this._hass?.connection) return;
    ["ipl_goal", "ipl_match_finished"].forEach(evt => {
      this._hass.connection.subscribeEvents(e => this._handleEvent(e), evt)
        .then(unsub => this._eventSubscriptions.push(unsub));
    });
  }

  disconnectedCallback() {
    this._eventSubscriptions.forEach(u => u && u());
    this._eventSubscriptions = [];
    this._subscribed = false;
  }

  _handleEvent(event) {
    const d = event.data;
    const key = `${d.home_team}_${d.away_team}`;
    let msg = "";
    if (event.event_type === "ipl_goal") {
      msg = `⚽ שער! ${d.player} — ${d.home_team} ${d.home_score}:${d.away_score} ${d.away_team}`;
    } else if (event.event_type === "ipl_match_finished") {
      msg = `✅ סיום: ${d.home_team} ${d.home_score}:${d.away_score} ${d.away_team}`;
    }
    if (msg && this._hass) {
      this._hass.callService("persistent_notification", "create", {
        message: msg, title: "ליגת העל"
      }).catch(() => {});
    }
    this._recentEvents.set(key, true);
    this._lastFixturesJson = null;
    this._render();
    setTimeout(() => {
      this._recentEvents.delete(key);
      this._lastFixturesJson = null;
      this._render();
    }, 5000);
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    const [day, month, year] = dateStr.split("/");
    const date     = new Date(`${year}-${month}-${day}`);
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1); tomorrow.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    if (date.getTime() === today.getTime())    return "היום";
    if (date.getTime() === tomorrow.getTime()) return "מחר";
    const days = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
    return `יום ${days[date.getDay()]}׳ ${day}.${month}`;
  }

  _isLive(s)     { return ["1H","2H","HT","ET","P"].includes(s); }
  _isFinished(s) { return ["FT","AET","PEN"].includes(s); }

  _centerHtml(f) {
    if (this._isLive(f.status_short)) return `
      <div class="score live">${f.home_score ?? 0} - ${f.away_score ?? 0}</div>
      <div class="live-badge">● LIVE</div>`;
    if (this._isFinished(f.status_short)) return `
      <div class="score finished">${f.home_score ?? 0} - ${f.away_score ?? 0}</div>
      <div class="status-label">${f.status}</div>`;
    return `
      <div class="match-time">${f.match_time}</div>
      <div class="vs">נגד</div>`;
  }

  _render() {
    if (!this._hass || !this._config) return;

    const cfg     = this._config;
    const stateObj = this._hass.states[cfg.entity];
    const title   = cfg.title || "ליגת העל";
    const maxVis  = cfg.max_events_visible ?? 5;
    const maxTot  = cfg.max_events_total   ?? 20;
    const showFin = cfg.show_finished_matches !== false;
    const showCh  = cfg.show_channels !== false;
    const hideHdr = cfg.hide_header === true;

    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;color:red">Entity לא נמצא: ${cfg.entity}</div></ha-card>`;
      return;
    }

    let fixtures = (stateObj.attributes.fixtures || []).slice();
    if (!showFin) fixtures = fixtures.filter(f => !this._isFinished(f.status_short));
    fixtures = fixtures.slice(0, maxTot);

    const groups = {};
    for (const f of fixtures) {
      const k = f.match_date || "unknown";
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    }

    const scrollHeight = maxVis * 130;

    let groupsHtml = "";
    for (const [date, games] of Object.entries(groups)) {
      groupsHtml += `<div class="date-row"><span class="date-label">${this._formatDate(date)}</span></div>`;
      games.forEach((f, idx) => {
        const key       = `${f.home_team}_${f.away_team}`;
        const highlight = this._recentEvents.has(key) ? "highlight" : "";
        const homeLogo  = f.home_logo
          ? `<img class="logo" src="${f.home_logo}" alt="${f.home_team}" onerror="this.style.display='none'">`
          : `<div class="logo-ph">⚽</div>`;
        const awayLogo  = f.away_logo
          ? `<img class="logo" src="${f.away_logo}" alt="${f.away_team}" onerror="this.style.display='none'">`
          : `<div class="logo-ph">⚽</div>`;
        const channelHtml = showCh && f.channels
          ? `<div class="channels">📺 ${f.channels}</div>` : "";
        const sepHtml = idx < games.length - 1 ? `<hr class="sep">` : "";

        groupsHtml += `
          <div class="match-wrapper ${highlight}">
            <div class="match-row">
              <div class="team home">
                ${homeLogo}
                <span class="team-name">${f.home_team}</span>
              </div>
              <div class="center">
                ${this._centerHtml(f)}
                ${channelHtml}
              </div>
              <div class="team away">
                ${awayLogo}
                <span class="team-name">${f.away_team}</span>
              </div>
            </div>
            ${sepHtml}
          </div>`;
      });
    }

    const emptyHtml = fixtures.length === 0
      ? `<div class="empty">אין משחקים בימים הקרובים</div>` : "";

    const headerHtml = hideHdr ? "" : `
      <div class="card-header">
        <span class="header-icon">⚽</span>
        <span class="header-title">${title}</span>
        ${fixtures.length ? `<span class="badge">${fixtures.length}</span>` : ""}
      </div>`;

    // עדכון חלקי — רק תוכן הגלילה, בלי לאפס את המבנה
    if (this._initialized) {
      const scrollEl = this.shadowRoot.querySelector(".scroll-content");
      if (scrollEl) {
        scrollEl.innerHTML = emptyHtml + groupsHtml;
        return;
      }
    }

    // render ראשון בלבד
    this._initialized = true;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          direction: rtl;
          font-family: 'Segoe UI', 'Arial Hebrew', Arial, sans-serif;
        }
        ha-card {
          background: var(--ha-card-background, #1a1a2e);
          border-radius: 16px;
          overflow: hidden;
          color: var(--primary-text-color, #eaeaea);
          padding: 0;
          display: block;
        }
        .card-header {
          background: linear-gradient(135deg, #0f3460 0%, #16213e 100%);
          padding: 13px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .header-icon { font-size: 20px; }
        .header-title { font-size: 15px; font-weight: 700; flex: 1; }
        .badge {
          background: #e94560;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 100px;
        }
        .scroll-content {
          overflow-y: auto;
          max-height: ${scrollHeight}px;
        }
        .empty {
          padding: 32px;
          text-align: center;
          color: var(--secondary-text-color, #9ca3af);
        }
        .date-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px 3px;
        }
        .date-row::before, .date-row::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .date-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--secondary-text-color, #6b7280);
          letter-spacing: 0.7px;
          white-space: nowrap;
        }
        .match-wrapper { padding: 0 4px; }
        .match-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 11px 12px;
          gap: 6px;
          transition: background 0.15s;
        }
        .match-row:hover { background: rgba(255,255,255,0.04); }
        .highlight { animation: pulse-highlight 0.7s ease-out; }
        @keyframes pulse-highlight {
          0%   { box-shadow: 0 0 0 0 rgba(255,152,0,.7); }
          50%  { box-shadow: 0 0 0 8px rgba(255,152,0,0); }
          100% { box-shadow: none; }
        }
        .sep {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin: 0 12px;
        }
        .team {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }
        .logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        .logo-ph {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .team-name {
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          line-height: 1.3;
          max-width: 85px;
          word-break: break-word;
        }
        .center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          min-width: 80px;
        }
        .match-time {
          font-size: 20px;
          font-weight: 700;
          color: #22c55e;
          letter-spacing: 1px;
          font-variant-numeric: tabular-nums;
        }
        .vs { font-size: 10px; color: var(--secondary-text-color, #6b7280); }
        .score {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 2px;
          font-variant-numeric: tabular-nums;
        }
        .score.live {
          color: #22c55e;
          text-shadow: 0 0 12px rgba(34,197,94,.4);
        }
        .score.finished { color: var(--secondary-text-color, #9ca3af); }
        .live-badge {
          font-size: 10px;
          font-weight: 700;
          color: #22c55e;
          animation: blink 1.4s ease-in-out infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
        .status-label { font-size: 10px; color: var(--secondary-text-color, #9ca3af); }
        .channels {
          font-size: 10px;
          color: var(--secondary-text-color, #6b7280);
          text-align: center;
          white-space: nowrap;
          margin-top: 2px;
        }
      </style>
      <ha-card>
        ${headerHtml}
        <div class="scroll-content">
          ${emptyHtml}
          ${groupsHtml}
        </div>
      </ha-card>`;
  }
}

customElements.define("israeli-premier-league-card", IsraeliPremierLeagueCard);

class IsraeliPremierLeagueCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _fire(config) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config }, bubbles: true, composed: true
    }));
  }

  _render() {
    if (!this._config) return;
    const c = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        .cfg { display:flex; flex-direction:column; gap:14px; padding:4px; direction:rtl; }
        label { font-size:13px; color:var(--primary-text-color); }
        .row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        input[type=text], input[type=number] {
          width:100%; padding:8px; border-radius:6px;
          border:1px solid var(--divider-color,#444);
          background:var(--card-background-color,#222);
          color:var(--primary-text-color,#fff);
          font-size:13px; box-sizing:border-box;
        }
        h4 { margin:4px 0 0; color:var(--primary-text-color); }
      </style>
      <div class="cfg">
        <h4>סנסור</h4>
        <div>
          <label>Entity ID</label>
          <input type="text" id="entity" value="${c.entity || ""}" placeholder="sensor.lygt_h_l_mshkhqym_qrvbym">
        </div>
        <div>
          <label>כותרת</label>
          <input type="text" id="title" value="${c.title || "ליגת העל"}">
        </div>
        <h4>הגדרות</h4>
        <div>
          <label>משחקים גלויים (ללא גלילה)</label>
          <input type="number" id="max_events_visible" value="${c.max_events_visible ?? 5}" min="1" max="20">
        </div>
        <div>
          <label>סך משחקים (עם גלילה)</label>
          <input type="number" id="max_events_total" value="${c.max_events_total ?? 20}" min="1" max="50">
        </div>
        <div class="row">
          <label>הצג משחקים שהסתיימו</label>
          <input type="checkbox" id="show_finished_matches" ${c.show_finished_matches !== false ? "checked" : ""}>
        </div>
        <div class="row">
          <label>הצג ערוצי שידור</label>
          <input type="checkbox" id="show_channels" ${c.show_channels !== false ? "checked" : ""}>
        </div>
        <div class="row">
          <label>הסתר כותרת</label>
          <input type="checkbox" id="hide_header" ${c.hide_header ? "checked" : ""}>
        </div>
      </div>`;

    this.shadowRoot.querySelectorAll("input").forEach(el => {
      el.addEventListener("change", () => {
        const cfg = { ...this._config };
        if (el.type === "checkbox") cfg[el.id] = el.checked;
        else if (el.type === "number") cfg[el.id] = parseInt(el.value, 10);
        else cfg[el.id] = el.value;
        this._config = cfg;
        this._fire(cfg);
      });
    });
  }
}

customElements.define("israeli-premier-league-card-editor", IsraeliPremierLeagueCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "israeli-premier-league-card",
  name: "Israeli Premier League Card",
  description: "כרטיס משחקי ליגת העל הישראלית עם לוגואים, שעות ועדכון חי",
  preview: true,
});
