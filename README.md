# 🇮🇱 ליגת העל — Israeli Premier League Card

<div align="center">

![HA](https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue?style=for-the-badge&logo=homeassistant)
![HACS](https://img.shields.io/badge/HACS-Custom-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

כרטיס Lovelace להצגת משחקי **ליגת העל הישראלית** ב-Home Assistant

</div>

---

## ✨ תכונות

| תכונה | תיאור |
|-------|-------|
| ⚽ | לוגואים של כל הקבוצות |
| ⏰ | שעות בשעון ישראל |
| 📅 | קיבוץ לפי היום / מחר / תאריך |
| 🔴 | תוצאות חיות עם אנימציית LIVE |
| ✅ | תוצאות סופיות |
| 📺 | ערוצי שידור |
| 🔔 | התראות HA על שערים וסיום משחק |
| ✏️ | עורך ויזואלי מובנה ב-HA |

---

## 📦 דרישות מוקדמות

קודם כל יש להתקין את האינטגרציה:
👉 [israeli-premier-league-ha](https://github.com/razserv2010/israeli-premier-league-ha)

---

## 🚀 התקנה דרך HACS

1. פתח **HACS** ב-Home Assistant
2. עבור ל **Frontend**
3. לחץ על ⋮ → **Custom repositories**
4. הוסף:
   - **Repository:** `razserv2010/israeli-premier-league-card`
   - **Category:** `Dashboard`
5. חפש **Israeli Premier League Card** והתקן
6. רענן את הדפדפן **(Ctrl+F5)**

---

## ⚙️ הגדרה

הוסף את הכרטיס ל-Dashboard שלך:

```yaml
type: custom:israeli-premier-league-card
entity: sensor.ligat_haal_meshahkim_karovim
title: ליגת העל
max_events_visible: 5
max_events_total: 20
show_finished_matches: true
show_channels: true
hide_header: false
```

---

## 🎛️ אפשרויות

| הגדרה | סוג | ברירת מחדל | תיאור |
|-------|-----|-----------|-------|
| `entity` | string | **חובה** | סנסור ראשי מהאינטגרציה |
| `title` | string | `ליגת העל` | כותרת הכרטיס |
| `max_events_visible` | number | `5` | משחקים גלויים ללא גלילה |
| `max_events_total` | number | `20` | סך משחקים כולל גלילה |
| `show_finished_matches` | boolean | `true` | הצג משחקים שהסתיימו |
| `show_channels` | boolean | `true` | הצג ערוצי שידור |
| `hide_header` | boolean | `false` | הסתר כותרת |

---

## 🔔 התראות

הכרטיס מאזין לאירועי HA ומציג התראות אוטומטיות על:
- ⚽ **שער** — כולל שם השחקן ותוצאה עדכנית
- ✅ **סיום משחק** — עם תוצאה סופית

---

## 📝 רישיון

MIT License © 2025 razserv2010
