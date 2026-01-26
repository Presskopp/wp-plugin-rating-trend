# WP Plugin Rating Trend

A lightweight Chrome extension that adds a **rating trend chart (last 12 months)** to WordPress.org plugin pages.

It visualizes how plugin ratings evolve over time — something WordPress.org itself does not show.

---

## ✨ Features

- 📈 Rating trend chart for the **last 12 months**
- ⭐ Monthly average (1–5 stars)
- 🚫 No gaps: missing months are interpolated
- 🕒 Stops early once enough data is collected
- ⚡ Performance-optimized:
- 🎯 Partial HTML parsing (reviews only)
- 💾 Local cache (6 hours)
- 🌍 i18n support
- 🧠 Smart fallback on localized WordPress sites
- ❌ No output if reviews are outdated

---

## 📍 Where it works

- ✅ `wordpress.org/plugins/...`
- ❌ Localized sites (e.g. `de.wordpress.org`)  
  → shows a fallback message with a link to wordpress.org

---

## 🖼 Screenshot

![Rating Trend Screenshot](screenshot.png)

---

## 🔧 Installation (Chrome)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select this project folder

Done 🎉  
The chart will appear on WordPress.org plugin pages below the rating stars.

---

## 🛠 How it works (short)

- Scrapes review pages from `wordpress.org/support/plugin/{slug}/reviews/`
- Fetches only what’s needed (reviews list)
- Builds a monthly average series
- Renders a lightweight SVG chart
- Stops fetching once 12 distinct months are found

No external APIs. No tracking. No data leaves your browser.

---

## ⚠️ Disclaimer

This extension **scrapes publicly available data** from WordPress.org.  
It is intended for **personal use and analysis**.

Not affiliated with or endorsed by WordPress.org.

---

## 📄 License

MIT
