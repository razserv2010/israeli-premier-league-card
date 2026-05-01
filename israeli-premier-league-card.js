class IsraeliPremierLeagueCard extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this._lastData = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("יש להגדיר entity");
    this._config = config;
    this._initialized = false;
    this._lastData = null;
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    const newData = JSON.stringify(stateObj?.attributes?.fixtures || []);
    if (newData === this._lastData) return;
    this._lastData = newData;
    this._updateCard(stateObj);
  }

  getCardSize() { return 3; }

  static getConfigElement() {
    return document.createElement("israeli-premier-league-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.lygt_h_l_mshkhqym_qrvbym" };
  }

  _formatDate(dateStr) {
    if (!dateStr) return "";
    const [day, month, year] = dateStr.split("/");
    const d = new Date(`${year}-${month}-${day}`);
    const today = new Date(); today.setHours(0,0,0,0);
    const tom   = new Date(); tom.setDate(today.getDate()+1); tom.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    if (d.getTime() === today.getTime()) return "היום";
    if (d.getTime() === tom.getTime())   return "מחר";
    const days = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
    return `יום ${days[d.getDay()]}׳ ${day}.${month}`;
  }

  // בדוק אם המשחק מתחיל בשעה הקרובה (ברירת מחדל: 60 דקות)
  _isSoon(f, minutesBefore) {
    if (!f.match_time || !f.match_date) return false;
    const LIVE = ["1H","2H","HT","ET","P"];
    const FINISHED = ["FT","AET","PEN"];
    if (LIVE.includes(f.status_short) || FINISHED.includes(f.status_short)) return false;
    try {
      const [day, month, year] = f.match_date.split("/");
      const [h, m] = f.match_time.split(":");
      const matchTime = new Date(`${year}-${month}-${day}T${h}:${m}:00`);
      const now = new Date();
      const diffMin = (matchTime - now) / 60000;
      return diffMin >= 0 && diffMin <= minutesBefore;
    } catch(e) { return false; }
  }

  _updateCard(stateObj) {
    const cfg        = this._config;
    const maxVis     = parseInt(cfg.max_events_visible) || 5;
    const maxTot     = parseInt(cfg.max_events_total)   || 20;
    const showFin    = cfg.show_finished_matches !== false;
    const showCh     = cfg.show_channels !== false;
    const hideHdr    = cfg.hide_header === true;
    const title      = cfg.title || "ליגת העל";
    const soonMins   = parseInt(cfg.soon_minutes) || 60;

    if (!stateObj) {
      this.innerHTML = `<ha-card style="padding:16px;color:red">Entity לא נמצא: ${cfg.entity}</ha-card>`;
      return;
    }

    const LIVE     = ["1H","2H","HT","ET","P"];
    const FINISHED = ["FT","AET","PEN"];

    let fixtures = (stateObj.attributes.fixtures || []).slice();
    if (!showFin) fixtures = fixtures.filter(f => !FINISHED.includes(f.status_short));
    fixtures = fixtures.slice(0, maxTot);

    const groups = {};
    fixtures.forEach(f => {
      const k = f.match_date || "?";
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    });

    let body = "";
    Object.entries(groups).forEach(([date, games]) => {
      body += `<div class="date-row"><span class="date-label">${this._formatDate(date)}</span></div>`;
      games.forEach((f, idx) => {
        const isLive = LIVE.includes(f.status_short);
        const isDone = FINISHED.includes(f.status_short);
        const isSoon = this._isSoon(f, soonMins);

        const center = isLive
          ? `<div class="score live">${f.home_score??0} - ${f.away_score??0}</div><div class="live-badge">● LIVE</div>`
          : isDone
          ? `<div class="score done">${f.home_score??0} - ${f.away_score??0}</div><div class="status-txt">${f.status}</div>`
          : `<div class="time ${isSoon?'soon-time':''}">${f.match_time}</div><div class="vs">${isSoon?'🔜 בקרוב':'נגד'}</div>`;

        const ch  = showCh && f.channels ? `<div class="ch">📺 ${f.channels}</div>` : "";
        const hl  = f.home_logo ? `<img class="logo" src="${f.home_logo}" onerror="this.style.display='none'">` : "⚽";
        const al  = f.away_logo ? `<img class="logo" src="${f.away_logo}" onerror="this.style.display='none'">` : "⚽";
        const sep = idx < games.length-1 ? `<hr class="sep">` : "";

        // מחלקות הדגשה
        const rowClass = isLive ? "mrow live-row" : isSoon ? "mrow soon-row" : isDone ? "mrow done-row" : "mrow";

        body += `
          <div class="${rowClass}">
            ${isSoon ? '<div class="soon-pulse"></div>' : ''}
            ${isLive ? '<div class="live-indicator"></div>' : ''}
            <div class="team"><div class="logo-wrap">${hl}</div><span class="tname">${f.home_team}</span></div>
            <div class="mid">${center}${ch}</div>
            <div class="team"><div class="logo-wrap">${al}</div><span class="tname">${f.away_team}</span></div>
          </div>${sep}`;
      });
    });

    if (!fixtures.length) body = `<div class="empty">אין משחקים בימים הקרובים</div>`;

    const header = hideHdr ? "" : `
      <div class="hdr">
        <span class="hdr-icon">⚽</span>
        <span class="htitle">ליגת העל</span>
        ${fixtures.length ? `<span class="badge">${fixtures.length}</span>` : ""}
      </div>`;

    const styles = `
      :host{display:block;direction:rtl;font-family:'Segoe UI','Arial Hebrew',Arial,sans-serif;}
      ha-card{background:var(--ha-card-background,#1a1a2e);border-radius:16px;overflow:hidden;color:var(--primary-text-color,#eaeaea);padding:0;display:block;box-shadow:0 4px 20px rgba(0,0,0,0.3);}

      /* ── כותרת ── */
      .hdr{background:linear-gradient(135deg,#1a3a6e 0%,#0f2040 100%);padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:2px solid rgba(255,255,255,0.15);}
      .hdr-icon{font-size:22px;}
      .htitle{font-size:16px;font-weight:800;flex:1;color:#ffffff;letter-spacing:0.5px;text-shadow:0 1px 3px rgba(0,0,0,0.5);}
      .badge{background:#e94560;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;box-shadow:0 2px 6px rgba(233,69,96,0.4);}

      /* ── גלילה ── */
      .scroll{overflow-y:auto;max-height:${maxVis*135}px;}
      .empty{padding:32px;text-align:center;color:#9ca3af;}

      /* ── תאריך ── */
      .date-row{display:flex;align-items:center;gap:8px;padding:8px 16px 4px;}
      .date-row::before,.date-row::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.08);}
      .date-label{font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.7px;white-space:nowrap;}

      /* ── שורת משחק ── */
      .mrow{position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:12px 16px;gap:8px;transition:background 0.2s;border-right:3px solid transparent;}
      .mrow:hover{background:rgba(255,255,255,0.04);}

      /* משחק שהסתיים */
      .done-row{opacity:0.6;}

      /* בקרוב */
      .soon-row{
        background:linear-gradient(135deg,rgba(251,191,36,0.08) 0%,rgba(245,158,11,0.05) 100%);
        border-right:3px solid #f59e0b;
        animation:soon-glow 2s ease-in-out infinite;
      }
      @keyframes soon-glow{
        0%,100%{box-shadow:inset 0 0 0 0 rgba(245,158,11,0);}
        50%{box-shadow:inset 0 0 20px 0 rgba(245,158,11,0.08);}
      }
      .soon-pulse{
        position:absolute;
        top:10px;left:10px;
        width:8px;height:8px;
        background:#f59e0b;
        border-radius:50%;
        animation:pulse-dot 1.5s ease-in-out infinite;
      }
      @keyframes pulse-dot{
        0%,100%{transform:scale(1);opacity:1;}
        50%{transform:scale(1.5);opacity:0.5;}
      }

      /* חי */
      .live-row{
        background:linear-gradient(135deg,rgba(34,197,94,0.1) 0%,rgba(16,185,129,0.05) 100%);
        border-right:3px solid #22c55e;
      }
      .live-indicator{
        position:absolute;
        top:10px;left:10px;
        width:8px;height:8px;
        background:#22c55e;
        border-radius:50%;
        animation:pulse-dot 1s ease-in-out infinite;
      }

      /* ── קבוצות ── */
      .sep{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 16px;}
      .team{display:flex;flex-direction:column;align-items:center;gap:5px;}
      .logo-wrap{width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:22px;}
      .logo{width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));}
      .tname{font-size:12px;font-weight:600;text-align:center;line-height:1.3;max-width:85px;word-break:break-word;}

      /* ── מרכז ── */
      .mid{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:80px;}
      .time{font-size:21px;font-weight:700;color:#22c55e;letter-spacing:1px;font-variant-numeric:tabular-nums;}
      .time.soon-time{color:#f59e0b;}
      .vs{font-size:10px;color:#6b7280;}
      .score{font-size:23px;font-weight:800;letter-spacing:2px;font-variant-numeric:tabular-nums;}
      .score.live{color:#22c55e;text-shadow:0 0 12px rgba(34,197,94,.5);}
      .score.done{color:#6b7280;}
      .live-badge{font-size:10px;font-weight:700;color:#22c55e;animation:blink 1.4s infinite;}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
      .status-txt{font-size:10px;color:#6b7280;}
      .ch{font-size:10px;color:#4b5563;text-align:center;white-space:nowrap;margin-top:3px;}
    `;

    if (!this._initialized) {
      this._initialized = true;
      this.innerHTML = `<ha-card><style>${styles}</style>${header}<div class="scroll" id="ipl-scroll">${body}</div></ha-card>`;
    } else {
      const el = this.querySelector("#ipl-scroll");
      if (el) el.innerHTML = body;
    }
  }
}

customElements.define("israeli-premier-league-card", IsraeliPremierLeagueCard);

class IsraeliPremierLeagueCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(h) {}

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _render() {
    const c = this._config;
    this.innerHTML = `<div style="direction:rtl;display:flex;flex-direction:column;gap:12px;padding:4px;">
      <div><label style="font-size:12px;color:#888;">Entity ID</label>
        <input id="f-entity" type="text" value="${c.entity||''}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#fff;font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#888;">כותרת</label>
        <input id="f-title" type="text" value="${c.title||'ליגת העל'}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#fff;font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#888;">משחקים גלויים (ללא גלילה)</label>
        <input id="f-vis" type="number" min="1" max="20" value="${c.max_events_visible||5}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#fff;font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#888;">סך משחקים (עם גלילה)</label>
        <input id="f-tot" type="number" min="1" max="50" value="${c.max_events_total||20}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#fff;font-size:13px;box-sizing:border-box;"></div>
      <div><label style="font-size:12px;color:#888;">הדגש משחק X דקות לפני (ברירת מחדל: 60)</label>
        <input id="f-soon" type="number" min="10" max="240" value="${c.soon_minutes||60}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#fff;font-size:13px;box-sizing:border-box;"></div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="f-fin" type="checkbox" ${c.show_finished_matches!==false?'checked':''}><span style="font-size:13px;">הצג משחקים שהסתיימו</span></label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="f-ch" type="checkbox" ${c.show_channels!==false?'checked':''}><span style="font-size:13px;">הצג ערוצי שידור</span></label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="f-hdr" type="checkbox" ${c.hide_header?'checked':''}><span style="font-size:13px;">הסתר כותרת</span></label>
    </div>`;
    this.querySelector("#f-entity").addEventListener("change", e => { this._config.entity = e.target.value; this._fire(); });
    this.querySelector("#f-title").addEventListener("change",  e => { this._config.title  = e.target.value; this._fire(); });
    this.querySelector("#f-vis").addEventListener("change",    e => { this._config.max_events_visible = parseInt(e.target.value); this._fire(); });
    this.querySelector("#f-tot").addEventListener("change",    e => { this._config.max_events_total   = parseInt(e.target.value); this._fire(); });
    this.querySelector("#f-soon").addEventListener("change",   e => { this._config.soon_minutes = parseInt(e.target.value); this._fire(); });
    this.querySelector("#f-fin").addEventListener("change",    e => { this._config.show_finished_matches = e.target.checked; this._fire(); });
    this.querySelector("#f-ch").addEventListener("change",     e => { this._config.show_channels = e.target.checked; this._fire(); });
    this.querySelector("#f-hdr").addEventListener("change",    e => { this._config.hide_header   = e.target.checked; this._fire(); });
  }
}

customElements.define("israeli-premier-league-card-editor", IsraeliPremierLeagueCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "israeli-premier-league-card",
  name: "Israeli Premier League Card",
  description: "כרטיס משחקי ליגת העל הישראלית",
  preview: true,
});
