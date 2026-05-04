class IsraeliPremierLeagueCard extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;
    this._lastData = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("יש להגדיר entity");
    this._config = config;
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

  _isLive(s)  { return ["1H","2H","ET","P","In Progress"].includes(s); }
  _isHalf(s)  { return ["HT","Halftime"].includes(s); }
  _isDone(s)  { return ["FT","AET","PEN","Match Finished","הסתיים"].includes(s); }
  _isSoon(f, mins) {
    if (!f.match_time || !f.match_date) return false;
    if (this._isLive(f.status_short) || this._isHalf(f.status_short) || this._isDone(f.status_short)) return false;
    try {
      const [day,month,year] = f.match_date.split("/");
      const [h,m] = f.match_time.split(":");
      const diff = (new Date(`${year}-${month}-${day}T${h}:${m}:00`) - new Date()) / 60000;
      return diff >= 0 && diff <= (parseInt(this._config.soon_minutes) || 60);
    } catch(e) { return false; }
  }

  _liveLabel(s) {
    if (["HT","Halftime"].includes(s)) return "הפסקה • LIVE";
    if (["1H","In Progress"].includes(s)) return "מחצית א׳ • LIVE";
    if (s === "2H") return "מחצית ב׳ • LIVE";
    if (s === "ET") return "הארכה • LIVE";
    if (s === "P")  return "פנדלים • LIVE";
    return "LIVE";
  }

  _updateCard(stateObj) {
    const cfg     = this._config;
    const maxVis  = parseInt(cfg.max_events_visible) || 5;
    const maxTot  = parseInt(cfg.max_events_total)   || 20;
    const showFin = cfg.show_finished_matches === true;
    const showCh  = cfg.show_channels !== false;
    const hideHdr = cfg.hide_header === true;
    const title   = cfg.title || "ליגת העל";

    if (!stateObj) {
      this.innerHTML = `<ha-card style="padding:16px;color:red">Entity לא נמצא: ${cfg.entity}</ha-card>`;
      return;
    }

    let fixtures = (stateObj.attributes.fixtures || []).slice();
    if (!showFin) fixtures = fixtures.filter(f => !this._isDone(f.status_short));
    fixtures = fixtures.slice(0, maxTot);

    const liveCount = fixtures.filter(f => this._isLive(f.status_short) || this._isHalf(f.status_short)).length;

    const groups = {};
    fixtures.forEach(f => {
      const k = f.match_date || "?";
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    });

    let body = "";
    const dateKeys = Object.keys(groups);
    dateKeys.forEach((date, dateIdx) => {
      const games = groups[date];
      // הפרדת ימים — קו עבה יותר בין ימים שונים
      body += `
        <div class="date-section ${dateIdx > 0 ? 'date-section-gap' : ''}">
          <div class="date-row">
            <div class="date-line"></div>
            <span class="date-label">${this._formatDate(date)}</span>
            <div class="date-line"></div>
          </div>
        </div>`;

      games.forEach((f, idx) => {
        const isLive = this._isLive(f.status_short);
        const isHalf = this._isHalf(f.status_short);
        const isDone = this._isDone(f.status_short);
        const isSoon = this._isSoon(f);

        const rowCls = (isLive || isHalf) ? "mrow live-row"
                     : isSoon             ? "mrow soon-row"
                     : isDone             ? "mrow done-row"
                     : "mrow";

        const dot = (isLive || isHalf)
          ? `<div class="indicator ind-live"></div>`
          : isSoon ? `<div class="indicator ind-soon"></div>` : "";

        let center = "";
        if (isLive || isHalf) {
          center = `
            <div class="score score-live">${f.home_score??0} - ${f.away_score??0}</div>
            <div class="live-pill">${this._liveLabel(f.status_short)}</div>`;
        } else if (isDone) {
          center = `
            <div class="score score-done">${f.home_score??0} - ${f.away_score??0}</div>
            <div class="tag tag-done">הסתיים</div>`;
        } else if (isSoon) {
          center = `
            <div class="time time-soon">${f.match_time}</div>
            <div class="tag tag-soon">🔜 בקרוב</div>`;
        } else {
          center = `
            <div class="time time-normal">${f.match_time}</div>
            <div class="vs">נגד</div>`;
        }

        const ch = showCh && f.channels ? `<div class="ch">📺 ${f.channels}</div>` : "";
        const hl = f.home_logo ? `<img class="logo" src="${f.home_logo}" onerror="this.style.display='none'">` : `<div class="logo-ph">⚽</div>`;
        const al = f.away_logo ? `<img class="logo" src="${f.away_logo}" onerror="this.style.display='none'">` : `<div class="logo-ph">⚽</div>`;
        const sep = idx < games.length-1 ? `<hr class="sep">` : "";

        body += `
          <div class="${rowCls}">
            ${dot}
            <div class="team">${hl}<span class="tname">${f.home_team}</span></div>
            <div class="mid">${center}${ch}</div>
            <div class="team">${al}<span class="tname">${f.away_team}</span></div>
          </div>${sep}`;
      });
    });

    if (!fixtures.length) body = `<div class="empty">אין משחקים בימים הקרובים</div>`;

    const liveTag = liveCount > 0
      ? `<span class="live-count">● ${liveCount} LIVE</span>`
      : `<span class="total-count">${fixtures.length} משחקים</span>`;

    const header = hideHdr ? "" : `
      <div class="hdr">
        <span class="hdr-flag">🇮🇱</span>
        <span class="hdr-title">${title}</span>
        ${liveTag}
      </div>`;

    const styles = `
      :host{display:block;direction:rtl;font-family:'Segoe UI','Arial Hebrew',Arial,sans-serif;}
      ha-card{background:#0f172a;border-radius:16px;overflow:hidden;color:#e2e8f0;padding:0;display:block;box-shadow:0 8px 32px rgba(0,0,0,0.4);}

      /* כותרת */
      .hdr{background:linear-gradient(90deg,#1e3a5f,#0f172a);padding:14px 18px;display:flex;align-items:center;gap:10px;position:relative;overflow:hidden;}
      .hdr::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,#3b82f6,transparent);}
      .hdr-flag{font-size:20px;}
      .hdr-title{font-size:15px;font-weight:800;color:#f8fafc;flex:1;}
      .live-count{font-size:11px;color:#4ade80;background:rgba(74,222,128,0.12);padding:3px 10px;border-radius:20px;border:1px solid rgba(74,222,128,0.25);font-weight:600;animation:pulse-live 2s infinite;}
      .total-count{font-size:11px;color:#60a5fa;background:rgba(96,165,250,0.1);padding:3px 10px;border-radius:20px;border:1px solid rgba(96,165,250,0.2);}
      @keyframes pulse-live{0%,100%{opacity:1;}50%{opacity:0.7;}}

      /* גלילה */
      .scroll{overflow-y:auto;max-height:${maxVis*145}px;}
      .empty{padding:32px;text-align:center;color:#475569;}

      /* הפרדת ימים */
      .date-section{padding:0;}
      .date-section-gap{margin-top:4px;border-top:2px solid rgba(96,165,250,0.15);}
      .date-row{display:flex;align-items:center;gap:8px;padding:10px 16px 4px;}
      .date-line{flex:1;height:1px;background:rgba(255,255,255,0.06);}
      .date-label{font-size:12px;font-weight:700;color:#60a5fa;white-space:nowrap;letter-spacing:0.3px;}

      /* שורת משחק */
      .mrow{position:relative;display:grid;grid-template-columns:1fr 80px 1fr;align-items:center;padding:12px 16px 12px 22px;gap:6px;border-right:2px solid transparent;transition:background 0.2s;}
      .mrow:hover{background:rgba(255,255,255,0.03);}
      .live-row{background:rgba(74,222,128,0.06);border-right:2px solid #4ade80;}
      .soon-row{background:rgba(167,139,250,0.06);border-right:2px solid #a78bfa;}
      .done-row{opacity:0.45;}
      .sep{border:none;border-top:1px solid rgba(255,255,255,0.04);margin:0 16px;}

      /* אינדיקטור */
      .indicator{position:absolute;top:14px;right:7px;width:6px;height:6px;border-radius:50%;}
      .ind-live{background:#4ade80;animation:blink-dot 1s infinite;}
      .ind-soon{background:#a78bfa;animation:blink-dot 1.5s infinite;}
      @keyframes blink-dot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(1.5);}}

      /* קבוצות */
      .team{display:flex;flex-direction:column;align-items:center;gap:5px;}
      .logo{width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));}
      .logo-ph{width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:22px;}
      .tname{font-size:12px;font-weight:600;text-align:center;line-height:1.3;max-width:82px;color:#cbd5e1;}

      /* מרכז */
      .mid{display:flex;flex-direction:column;align-items:center;gap:3px;}
      .time{font-size:22px;font-weight:700;letter-spacing:1px;font-variant-numeric:tabular-nums;}
      .time-normal{color:#a78bfa;}
      .time-soon{color:#a78bfa;opacity:0.8;}
      .vs{font-size:11px;color:#475569;font-weight:500;}
      .score{font-size:24px;font-weight:800;letter-spacing:2px;font-variant-numeric:tabular-nums;}
      .score-live{color:#4ade80;text-shadow:0 0 16px rgba(74,222,128,0.4);}
      .score-done{color:#475569;}

      /* LIVE pill */
      .live-pill{
        font-size:10px;font-weight:700;color:#4ade80;
        background:rgba(74,222,128,0.12);
        border:1px solid rgba(74,222,128,0.3);
        padding:2px 8px;border-radius:20px;
        animation:blink 1.4s infinite;
        white-space:nowrap;
      }
      @keyframes blink{0%,100%{opacity:1;}50%{opacity:.4;}}

      .tag{font-size:10px;font-weight:700;}
      .tag-soon{color:#a78bfa;}
      .tag-done{color:#475569;}
      .ch{font-size:10px;color:#475569;text-align:center;margin-top:4px;white-space:nowrap;}
    `;

    if (!this._initialized) {
      this._initialized = true;
      this.innerHTML = `<ha-card><style>${styles}</style>${header}<div class="scroll" id="ipl-scroll">${body}</div></ha-card>`;
    } else {
      const scrollEl = this.querySelector("#ipl-scroll");
      if (scrollEl) scrollEl.innerHTML = body;
      const liveEl = this.querySelector(".live-count, .total-count");
      if (liveEl) {
        liveEl.className = liveCount > 0 ? "live-count" : "total-count";
        liveEl.textContent = liveCount > 0 ? `● ${liveCount} LIVE` : `${fixtures.length} משחקים`;
      }
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
    this.innerHTML = `
      <div style="direction:rtl;display:flex;flex-direction:column;gap:12px;padding:4px;">
        <div>
          <label style="font-size:12px;color:var(--secondary-text-color);">Entity ID</label>
          <input id="f-entity" type="text" value="${c.entity||''}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--input-fill-color,var(--secondary-background-color,#f5f5f5));color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--secondary-text-color);">כותרת</label>
          <input id="f-title" type="text" value="${c.title||'ליגת העל'}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--input-fill-color,var(--secondary-background-color,#f5f5f5));color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--secondary-text-color);">משחקים גלויים (ללא גלילה)</label>
          <input id="f-vis" type="number" min="1" max="20" value="${c.max_events_visible||5}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--input-fill-color,var(--secondary-background-color,#f5f5f5));color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--secondary-text-color);">סך משחקים (עם גלילה)</label>
          <input id="f-tot" type="number" min="1" max="50" value="${c.max_events_total||20}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--input-fill-color,var(--secondary-background-color,#f5f5f5));color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--secondary-text-color);">הדגש משחק X דקות לפני</label>
          <input id="f-soon" type="number" min="10" max="240" value="${c.soon_minutes||60}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--input-fill-color,var(--secondary-background-color,#f5f5f5));color:var(--primary-text-color,#212121);font-size:13px;box-sizing:border-box;">
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input id="f-fin" type="checkbox" ${c.show_finished_matches===true?'checked':''}>
          <span style="font-size:13px;color:var(--primary-text-color);">הצג משחקים שהסתיימו</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input id="f-ch" type="checkbox" ${c.show_channels!==false?'checked':''}>
          <span style="font-size:13px;color:var(--primary-text-color);">הצג ערוצי שידור</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input id="f-hdr" type="checkbox" ${c.hide_header?'checked':''}>
          <span style="font-size:13px;color:var(--primary-text-color);">הסתר כותרת</span>
        </label>
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
