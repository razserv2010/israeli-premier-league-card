import { LitElement, html, css } from "lit-element";

// ─── כרטיס משחקים ────────────────────────────────────────────────────────────

class IsraeliPremierLeagueCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _recentEventMatches: { type: Object },
    };
  }

  constructor() {
    super();
    this._recentEventMatches = new Map();
    this._eventSubscriptions = [];
  }

  setConfig(config) {
    if (!config.entity) throw new Error("יש להגדיר entity");
    this._config = config;
    this.maxEventsVisible = config.max_events_visible ?? 5;
    this.maxEventsTotal   = config.max_events_total   ?? 20;
    this.showFinished     = config.show_finished_matches !== false;
    this.hideHeader       = config.hide_header === true;
    this.showChannels     = config.show_channels !== false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribeToEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._eventSubscriptions.forEach(sub => sub && sub());
    this._eventSubscriptions = [];
  }

  _subscribeToEvents() {
    if (!this.hass?.connection) return;
    const events = ["ipl_goal", "ipl_match_finished"];
    events.forEach(evt => {
      const unsub = this.hass.connection.subscribeEvents(
        this._handleEvent.bind(this), evt
      );
      this._eventSubscriptions.push(unsub);
    });
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
    if (msg && this.hass) {
      this.hass.callService("persistent_notification", "create", {
        message: msg, title: "ליגת העל"
      }).catch(() => {});
    }
    this._recentEventMatches.set(key, true);
    this.requestUpdate();
    setTimeout(() => { this._recentEventMatches.delete(key); this.requestUpdate(); }, 5000);
  }

  getCardSize() { return 3; }

  static getConfigElement() {
    return document.createElement("israeli-premier-league-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "sensor.ligat_haal_meshahkim_karovim",
      title: "ליגת העל",
      max_events_visible: 5,
      max_events_total: 20,
      show_finished_matches: true,
      show_channels: true,
      hide_header: false,
    };
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    const [day, month, year] = dateStr.split("/");
    const date = new Date(`${year}-${month}-${day}`);
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1); tomorrow.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    if (date.getTime() === today.getTime())    return "היום";
    if (date.getTime() === tomorrow.getTime()) return "מחר";
    const days = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
    return `יום ${days[date.getDay()]}׳ ${day}.${month}`;
  }

  _isLive(s) { return ["1H","2H","HT","ET","P"].includes(s); }
  _isFinished(s) { return ["FT","AET","PEN"].includes(s); }

  _centerContent(f) {
    if (this._isLive(f.status_short)) return html`
      <div class="score live">${f.home_score ?? 0} - ${f.away_score ?? 0}</div>
      <div class="live-badge">● LIVE</div>
    `;
    if (this._isFinished(f.status_short)) return html`
      <div class="score finished">${f.home_score ?? 0} - ${f.away_score ?? 0}</div>
      <div class="status-label">${f.status}</div>
    `;
    return html`
      <div class="match-time">${f.match_time}</div>
      <div class="vs">נגד</div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) return html`<ha-card><div class="error">Entity לא נמצא: ${this._config.entity}</div></ha-card>`;

    let fixtures = (stateObj.attributes.fixtures || []).slice();
    if (!this.showFinished) fixtures = fixtures.filter(f => !this._isFinished(f.status_short));
    fixtures = fixtures.slice(0, this.maxEventsTotal);

    const groups = {};
    for (const f of fixtures) {
      const k = f.match_date || "unknown";
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    }

    const scrollHeight = this.maxEventsVisible * 130;

    return html`
      <ha-card>
        ${this.hideHeader ? html`` : html`
          <div class="card-header">
            <span class="header-icon">⚽</span>
            <span class="header-title">${this._config.title || "ליגת העל"}</span>
            ${fixtures.length ? html`<span class="badge">${fixtures.length}</span>` : html``}
          </div>
        `}
        <div class="scroll-content" style="max-height:${scrollHeight}px; overflow-y:auto;">
          ${fixtures.length === 0 ? html`<div class="empty">אין משחקים בימים הקרובים</div>` : html``}
          ${Object.entries(groups).map(([date, games]) => html`
            <div class="date-row">
              <span class="date-label">${this._formatDate(date)}</span>
            </div>
            ${games.map((f, idx) => {
              const key = `${f.home_team}_${f.away_team}`;
              return html`
                <div class="match-wrapper ${this._recentEventMatches.has(key) ? "highlight" : ""}">
                  <div class="match-row">
                    <div class="team home">
                      ${f.home_logo
                        ? html`<img class="logo" src="${f.home_logo}" alt="${f.home_team}" onerror="this.style.display='none'">`
                        : html`<div class="logo-ph">⚽</div>`}
                      <span class="team-name">${f.home_team}</span>
                    </div>
                    <div class="center">
                      ${this._centerContent(f)}
                      ${this.showChannels && f.channels
                        ? html`<div class="channels">📺 ${f.channels}</div>`
                        : html``}
                    </div>
                    <div class="team away">
                      ${f.away_logo
                        ? html`<img class="logo" src="${f.away_logo}" alt="${f.away_team}" onerror="this.style.display='none'">`
                        : html`<div class="logo-ph">⚽</div>`}
                      <span class="team-name">${f.away_team}</span>
                    </div>
                  </div>
                  ${idx < games.length - 1 ? html`<hr class="sep">` : html``}
                </div>
              `;
            })}
          `)}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
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
      }
      .error { padding: 16px; color: red; }
      .empty { padding: 32px; text-align: center; color: var(--secondary-text-color, #9ca3af); }
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
        transition: backgr
