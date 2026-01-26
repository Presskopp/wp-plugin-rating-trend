(async function () {

  if (!location.pathname.startsWith("/plugins/")) return;
  const slug = location.pathname.split("/")[2];
  if (!slug) return;

  const ratingsBlock = document.querySelector(".wp-block-wporg-ratings-stars");
  if (!ratingsBlock) return;

  // ---------- i18n ----------
  const i18n = window.wporgReviewsI18n || {};
  const browserLang =
    (navigator.language || navigator.userLanguage || "en")
      .toLowerCase()
      .split("-")[0];
  const t = i18n[browserLang] || i18n.en;

  const titleHTML = `
    <div style="font-weight:600;font-size:20px;margin-bottom:12px">
      📈 ${t.title}
    </div>
  `;

  // ---------- Card ----------
  const card = document.createElement("div");
  card.style.cssText = `
    margin:16px 0 0;
    padding:18px;
    border:1px solid #e5e7eb;
    border-radius:14px;
    background:#fff;
    font-family:system-ui;
    max-width:760px;
  `;
  ratingsBlock.parentNode.insertBefore(card, ratingsBlock.nextSibling);
  card.innerHTML = `${titleHTML}<div style="opacity:.6">${t.loading}</div>`;

  // ---------- Time ----------
  const now = new Date();
  const currentYear = now.getFullYear();

  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startMonth = new Date(endMonth);
  startMonth.setMonth(startMonth.getMonth() - 11);

  const monthKey = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const monthKeyToDate = k => {
    const [y, m] = k.split("-").map(Number);
    return new Date(y, m - 1, 1);
  };

  // ---------- Fetch ----------
  async function fetchReviews() {
    const reviews = [];
    let page = 1;

    const monthsMap = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12"
    };

    while (page <= 10) {
      const url = page === 1
        ? `https://wordpress.org/support/plugin/${slug}/reviews/`
        : `https://wordpress.org/support/plugin/${slug}/reviews/page/${page}/`;

      const res = await fetch(url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const topics = [...doc.querySelectorAll('ul[id^="bbp-topic-"]')];

      let foundRelevant = false;

      for (const topic of topics) {
        const stars = topic.querySelectorAll(".dashicons-star-filled").length;
        const title = topic.querySelector(".bbp-topic-freshness a")?.getAttribute("title");
        if (!stars || !title) continue;

        const m = title.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})/);
        if (!m) continue;

        const key = `${m[3]}-${monthsMap[m[1]]}`;
        const date = monthKeyToDate(key);

        if (date >= startMonth && date <= endMonth) {
          reviews.push({ stars, month: key });
          foundRelevant = true;
        }
      }

      if (!foundRelevant) break;
      page++;
    }

    return reviews;
  }

  // ---------- Timeline (data only) ----------
  function buildTimeline(reviews) {
    const byMonth = {};
    reviews.forEach(r => {
      if (!byMonth[r.month]) byMonth[r.month] = [];
      byMonth[r.month].push(r.stars);
    });

    const timeline = [];
    let d = new Date(startMonth);
    let firstReal = null;

    for (let i = 0; i < 12; i++) {
      const key = monthKey(d);
      if (byMonth[key]) {
        const avg = byMonth[key].reduce((a, b) => a + b, 0) / byMonth[key].length;
        timeline.push({ i, avg, real: true });
        if (firstReal === null) firstReal = i;
      } else {
        timeline.push({ i, avg: null, real: false });
      }
      d.setMonth(d.getMonth() + 1);
    }

    if (firstReal === null) return [];
    return timeline.slice(firstReal);
  }

  // ---------- Bezier ----------
  function safeBezier(points) {
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = (p2.x - p1.x) / 3;
      const dy = (p2.y - p1.y) / 12;
      d += ` C ${p1.x + dx},${p1.y + dy} ${p2.x - dx},${p2.y - dy} ${p2.x},${p2.y}`;
    }
    return d;
  }

  // ---------- Render ----------
  function render(timeline) {
    const width = 760, height = 340;
    const padL = 50, padR = 40, padT = 20, padB = 90;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const scaleX = i => padL + (i / 11) * chartW;
    const scaleY = v =>
      height - padB - ((Math.min(5, Math.max(0, v)) - 1) / 4) * chartH;

    // Y grid
    const yGrid = [1, 2, 3, 4, 5].map(v => {
      const y = scaleY(v);
      return `
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#e5e7eb"/>
        <text x="${padL - 10}" y="${y + 8}" font-size="28" text-anchor="end">${v}</text>
      `;
    }).join("");

    // X labels — ALWAYS 12 MONTHS
    const axisMonths = [];
    let d = new Date(startMonth);
    for (let i = 0; i < 12; i++) {
      axisMonths.push({ i, date: new Date(d) });
      d.setMonth(d.getMonth() + 1);
    }

    const xLabels = axisMonths.map((m, idx) => {
      const month = m.date.getMonth() + 1;
      const year = m.date.getFullYear();
      const showYear = idx === 0 || (month === 1 && year === currentYear);
      const label = showYear ? `${year}-${month}` : `${month}`;

      return `
        <text x="${scaleX(m.i)}" y="${height - 40}"
              font-size="26" text-anchor="middle">
          ${label}
        </text>
      `;
    }).join("");

    // Points (real only)
    const pts = timeline.filter(m => m.real).map(m => ({
      x: scaleX(m.i),
      y: scaleY(m.avg),
      idx: m.i
    }));

    // Segments
    const segments = [];
    let current = null;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const solid = b.idx === a.idx + 1;

      if (!current || current.solid !== solid) {
        if (current) segments.push(current);
        current = { solid, pts: [a, b] };
      } else {
        current.pts.push(b);
      }
    }
    if (current) segments.push(current);

    const paths = segments.map(seg => `
      <path d="${safeBezier(seg.pts)}"
            fill="none"
            stroke="#2563eb"
            stroke-width="4"
            ${seg.solid ? "" : 'stroke-dasharray="6 6" opacity="0.7"'} />
    `).join("");

    const dots = timeline
      .filter(m => m.real)
      .map(m => `
        <circle
          cx="${scaleX(m.i)}"
          cy="${scaleY(m.avg)}"
          r="6"
          fill="#2563eb"
        />
      `).join("");


    card.innerHTML = `
      ${titleHTML}
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto">
        ${yGrid}
        ${paths}
        ${dots}
        ${xLabels}
      </svg>
      <div style="margin-top:12px;font-size:16px">${t.scale}</div>
    `;
  }

  // ---------- Run ----------
  const reviews = await fetchReviews();

  if (reviews.length < 5) {
    card.innerHTML = `${titleHTML}<div>${t.too_few_reviews}</div>`;
    return;
  }

  const timeline = buildTimeline(reviews);
  render(timeline);

})();
