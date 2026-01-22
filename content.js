(async function () {

  const DEBUG = false;
  const log = (...a) => DEBUG && console.log("[RatingTrend]", ...a);

  // Only run on plugin pages
  if (!location.pathname.startsWith("/plugins/")) return;

  const slug = location.pathname.split("/")[2];
  if (!slug) return;

  const ratingsBlock = document.querySelector(".wp-block-wporg-ratings-stars");
  if (!ratingsBlock) return;

  // ---------------- i18n (browser language) ----------------
  const LANG = (navigator.language || "en").split("-")[0];

  async function loadI18n() {
    try {
      const res = await fetch(chrome.runtime.getURL("i18n.json"));
      const json = await res.json();
      return json[LANG] || json.en;
    } catch {
      // absolute minimal fallback (should never happen)
      return {
        title: "Rating Trend · last 12 months",
        scale: "Scale: 1–5 stars · monthly average",
        view: "View rating trend",
        hosted: "Reviews are hosted on wordpress.org only",
        loading: "Loading data…",
        no_recent_data: "No current reviews"
      };
    }
  }

  const t = await loadI18n();

  // ---------------- Card ----------------
  const card = document.createElement("div");
  card.style.cssText = `
    margin:16px 0 0 0;
    padding:18px;
    border:1px solid #e5e7eb;
    border-radius:14px;
    background:#fff;
    font-family:system-ui;
    max-width:760px;
  `;

  ratingsBlock.parentNode.insertBefore(card, ratingsBlock.nextSibling);

  // ---------------- Render helpers ----------------
  function renderLoading() {
    card.innerHTML = `
      <div style="font-weight:600;font-size:20px;margin-bottom:12px">
        📈 ${t.title}
      </div>
      <div style="font-size:14px;opacity:.7">
        ${t.loading}
      </div>
    `;
  }

  function renderHostedFallback() {
    card.innerHTML = `
      <div style="font-weight:600;font-size:20px;margin-bottom:12px">
        📈 ${t.title}
      </div>

      <div style="font-size:13px;opacity:.7;margin-bottom:8px">
        ${t.hosted}
      </div>

      <a class="external-link"
         href="https://wordpress.org/plugins/${slug}/#reviews"
         rel="nofollow"
         target="_blank">
         ${t.view}
      </a>
    `;
  }

  function renderNoRecentData() {
    card.innerHTML = `
      <div style="font-weight:600;font-size:20px;margin-bottom:12px">
        📈 ${t.title}
      </div>

      <div style="font-size:14px;opacity:.7">
        ${t.no_recent_data}
      </div>
    `;
  }

  // ---------------- Domain check ----------------
  const IS_WORDPRESS_ORG =
    location.hostname === "wordpress.org" &&
    location.pathname.startsWith("/plugins/");

  // Any localized WP site → hosted fallback
  if (!IS_WORDPRESS_ORG) {
    renderHostedFallback();
    return;
  }

  // ---------------- Genuine wordpress.org page ----------------
  renderLoading();

  // ---------------- Cache (6 hours) ----------------
  const CACHE_KEY = "ratingtrend_" + slug;
  const CACHE_TTL = 1000 * 60 * 60 * 6;

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.time < CACHE_TTL) return c.data;
    } catch {}
    return null;
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        time: Date.now(),
        data
      }));
    } catch {}
  }

  // ---------------- Fetch reviews ----------------
  async function fetchPage(page) {
    const url =
      page === 1
        ? `https://wordpress.org/support/plugin/${slug}/reviews/`
        : `https://wordpress.org/support/plugin/${slug}/reviews/page/${page}/`;

    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const topics = [...doc.querySelectorAll('ul[id^="bbp-topic-"]')];

    const monthsMap = {
      January:"01", February:"02", March:"03", April:"04",
      May:"05", June:"06", July:"07", August:"08",
      September:"09", October:"10", November:"11", December:"12"
    };

    return topics.map(t => {
      const stars = t.querySelectorAll(".dashicons-star-filled").length;
      const title = t.querySelector(".bbp-topic-freshness a")?.getAttribute("title");
      if (!stars || !title) return null;

      const m = title.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})/);
      if (!m) return null;

      return {
        stars,
        month: `${m[3]}-${monthsMap[m[1]]}`
      };
    }).filter(Boolean);
  }

  // ---------------- Loader ----------------
  async function loadReviewsSmart() {
    let page = 1;
    const reviews = [];
    const months = new Set();

    while (page <= 10) {
      const batch = await fetchPage(page);
      if (!batch.length) break;

      for (const r of batch) {
        reviews.push(r);
        months.add(r.month);
      }

      // Stop once 12 distinct months are collected
      if (months.size >= 12) break;
      page++;
    }

    return reviews;
  }

  // ---------------- Freshness check ----------------
  function isRecentEnough(reviews) {
    if (!reviews.length) return false;

    const months = reviews.map(r => r.month).sort();
    const lastMonth = months[months.length - 1];

    const [y, m] = lastMonth.split("-").map(Number);
    const lastDate = new Date(y, m - 1, 1);

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    return lastDate >= cutoff;
  }

  // ---------------- Monthly series ----------------
  function buildMonthlySeries(reviews) {
    if (!reviews.length) return [];

    const byMonth = {};
    reviews.forEach(r => {
      if (!byMonth[r.month]) byMonth[r.month] = [];
      byMonth[r.month].push(r.stars);
    });

    const months = Object.keys(byMonth).sort();
    const firstMonth = months[0];
    const lastMonth  = months[months.length - 1];

    const [startY, startM] = firstMonth.split("-").map(Number);
    const [endY, endM]     = lastMonth.split("-").map(Number);

    const timeline = [];
    let d = new Date(startY, startM - 1, 1);
    const end = new Date(endY, endM - 1, 1);

    while (d <= end) {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      timeline.push(key);
      d.setMonth(d.getMonth() + 1);
    }

    const visible = timeline.slice(-12);

    const series = [];
    let lastValue = null;

    for (const key of visible) {
      if (byMonth[key]) {
        const avg = byMonth[key].reduce((a,b)=>a+b,0) / byMonth[key].length;
        lastValue = avg;
        series.push({ month: key, avg });
      } else if (lastValue !== null) {
        series.push({ month: key, avg: lastValue });
      }
    }

    return series;
  }

  // ---------------- Chart ----------------
  function renderChart(series) {
    const width = 760, height = 320;
    const padL = 50, padR = 40, padT = 20, padB = 70;

    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const scaleX = i => padL + (i/(series.length-1)) * chartW;
    const scaleY = v => height - padB - ((v-1)/4) * chartH;

    const path = series.map((p,i)=>{
      const x = scaleX(i);
      const y = scaleY(p.avg);
      return `${i===0?"M":"L"}${x},${y}`;
    }).join(" ");

    const yGrid = [1,2,3,4,5].map(v=>{
      const y = scaleY(v);
      return `
        <line x1="${padL}" y1="${y}" x2="${width-padR}" y2="${y}" stroke="#e5e7eb"/>
        <text x="${padL-10}" y="${y+8}" font-size="28" text-anchor="end">${v}</text>
      `;
    }).join("");

    const xLabels = series.map((p,i)=>{
      const [y,m] = p.month.split("-");
      const month = String(Number(m));
      const label = i===0 || month==="1" ? `${y}-${month}` : month;
      return `<text x="${scaleX(i)}" y="${height-30}" font-size="26" text-anchor="middle">${label}</text>`;
    }).join("");

    card.innerHTML = `
      <div style="font-weight:600;font-size:20px;margin-bottom:12px">
        📈 ${t.title}
      </div>

      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;overflow:visible">
        ${yGrid}
        <path d="${path}" fill="none" stroke="#2563eb" stroke-width="4"/>
        ${xLabels}
      </svg>

      <div style="margin-top:12px;font-size:16px">
        ${t.scale}
      </div>
    `;
  }

  // ---------------- Run ----------------
  let reviews = loadCache();

  if (!reviews) {
    reviews = await loadReviewsSmart();
    if (!reviews.length) return;
    saveCache(reviews);
  }

  if (!isRecentEnough(reviews)) {
    renderNoRecentData();
    return;
  }

  const series = buildMonthlySeries(reviews);
  if (!series.length) return;

  renderChart(series);

})();
