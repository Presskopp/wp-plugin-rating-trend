(async function() {

	const VERSION = "1.1.6";

	// ---------------- Guards ----------------
	const IS_WPORG =
		(location.hostname === "wordpress.org" ||
		location.hostname.endsWith(".wordpress.org")) &&
		location.pathname.startsWith("/plugins/");

	if (!IS_WPORG) return;

	const IS_CANONICAL =
		location.hostname === "wordpress.org";

	const parts = location.pathname.split("/").filter(Boolean);
	const slug = parts[1];
	if (!slug) return;

	const ratingsBlock = document.querySelector(".wp-block-wporg-ratings-stars");
	if (!ratingsBlock) return;

	// ------------ browser check ------------
	const isFirefox = navigator.userAgent.includes("Firefox");

	// ---------------- i18n ----------------
	const i18n = window.wporgReviewsI18n || {};
	const browserLang =
		(navigator.language || "en")
			.toLowerCase()
			.split("-")[0];
	const t = i18n[browserLang] || i18n.en;

	// ---------------- CSS (once) ----------------
	if (!document.getElementById("rt-style")) {
		const style = document.createElement("style");
		style.id = "rt-style";
		style.textContent = `
			.rt-title {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 12px;
				font-weight: 600;
				font-size: 20px;
			}

			.rt-title-text {
				line-height: 1.3;
			}

			.rt-review-count {
				opacity: .6;
				font-weight: 400;
				font-size: 14px;
			}

			.rt-info {
				position: relative;
				margin-left: 12px;
				color: #6b7280;
				font-size: 14px;
				cursor: help;
				flex-shrink: 0;
			}

			.rt-info:hover .rt-popover,
			.rt-info:focus .rt-popover {
				opacity: 1;
				pointer-events: auto;
				transform: translateY(0);
			}

			.rt-popover {
				position: absolute;
				top: 22px;
				right: 0;
				width: 240px;
				padding: 10px 12px;
				font-size: 13px;
				line-height: 1.4;
				color: #111827;
				background: #fff;
				border: 1px solid #e5e7eb;
				border-radius: 8px;
				box-shadow: 0 10px 25px rgba(0,0,0,.08);
				opacity: 0;
				pointer-events: none;
				transform: translateY(-4px);
				transition: all .15s ease;
				z-index: 20;
			}

			.rt-footer {
				font-size: 10px;
				margin-top: 5px;
			}

			.rt-footer-link {
				text-decoration: none;
				color: inherit;
				border-bottom: 1px dotted transparent;
			}

			.rt-footer-link:hover {
				border-bottom-color: currentColor;
			}


			/* -------- Loading -------- */

			.rt-loading {
				font-size: 16px;
				opacity: .7;
				display: inline-flex;
				align-items: center;
				gap: 6px;
			}

			.rt-loading-dots span {
				display: inline-block;
				width: 4px;
				height: 4px;
				margin-left: 2px;
				background: currentColor;
				border-radius: 50%;
				animation: rt-dot-bounce 1.4s ease-in-out infinite;
			}

			.rt-loading-dots span:nth-child(1) { animation-delay: 0s; }
			.rt-loading-dots span:nth-child(2) { animation-delay: .15s; }
			.rt-loading-dots span:nth-child(3) { animation-delay: .3s; }

			@keyframes rt-dot-bounce {
				0%, 80%, 100% {
					transform: translateY(0);
					opacity: 0.4;
				}
				40% {
					transform: translateY(-6px);
					opacity: 1;
				}
			}

			@media (prefers-reduced-motion: reduce) {
				.rt-loading-dots span {
					animation: none;
					opacity: .6;
				}
			}

			.rt-content {
				font-size: 16px;
				margin-bottom: 10px;
			}
		`;
		document.head.appendChild(style);
	}

	// ---------------- Title ----------------
	const titleHTML = `
		<div class="rt-title">
			<div class="rt-title-text">
				📈 ${t.title}<br>
				<span class="rt-review-count"></span>
			</div>

			<span class="rt-info" tabindex="0" aria-label="${t.legend}">
				ℹ️
				<span class="rt-popover">
					● ${t.tooltip_dots}<br>
					— &nbsp;${t.line} = ${t.tooltip_rating}<br>
					– – ${t.line} = ${t.tooltip_no_data}<br>
					${t.tooltip_y}
				</span>
			</span>
		</div>
	`;

	const loadingHTML = `
		<div class="rt-loading">
			<span class="rt-loading-text">${t.loading}</span>
			<span class="rt-loading-dots" aria-hidden="true">
				<span></span><span></span><span></span>
			</span>
		</div>
	`;

	const storeUrl = isFirefox
		? "https://addons.mozilla.org/firefox/addon/wordpress-plugin-rating-trends/"
		: "https://chromewebstore.google.com/detail/wp-rating-trend/gmkeigdmjfiefaaicjmihodhfnjclifk";

	const storeLink = `
		<a href="${storeUrl}" class="rt-footer-link">
			WordPress Plugin Rating Trends v${VERSION}
		</a>
	`;

	// ---------------- Card ----------------
	const card = document.createElement("div");
	card.style.cssText = `
		margin:16px 0 0;
		padding:18px 18px 3px 18px;
		border:1px solid #e5e7eb;
		border-radius:14px;
		background:#fff;
		font-family:system-ui;
		max-width:760px;
	`;
	ratingsBlock.parentNode.insertBefore(card, ratingsBlock.nextSibling);
	card.innerHTML = `${titleHTML}${loadingHTML}`;

	// ---------------- Domain fallback ----------------
	if (!IS_CANONICAL) {
		card.innerHTML = `
			${titleHTML}
			<div class="rt-content">
				${t.hosted}<br>
				<a class="external-link"
					href="https://wordpress.org/plugins/${slug}/"
					target="_blank" rel="noopener">
					${t.view}
				</a>
			</div>
		`;
		return;
	}

	// ---------------- Time window ----------------
	// Rolling 12-month window ending at the current month
	const now = new Date();
	const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startMonth = new Date(endMonth);
	startMonth.setMonth(startMonth.getMonth() - 11);

	// Convert Date → YYYY-MM key
	const monthKey = d =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

	// Convert YYYY-MM → Date (first day of month)
	const monthKeyToDate = k => {
		const [y, m] = k.split("-").map(Number);
		return new Date(y, m - 1, 1);
	};

	// ---------------- Cache ----------------
	// LocalStorage cache to avoid repeated scraping
	const CACHE_KEY = "ratingtrend_" + slug;
	const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

	function loadCache() {
		try {
			const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
			if (cached?.time && Array.isArray(cached?.data)) {
				if (Date.now() - cached.time < CACHE_TTL) {
					return cached.data;
				}
			}
		} catch (err) {
			console.warn("[RT] Cache load error:", err);
		}
		return null;
	}

	function saveCache(data) {
		try {
			localStorage.setItem(
				CACHE_KEY,
				JSON.stringify({
					time: Date.now(),
					data
				})
			);
		} catch (err) {
			console.warn("[RT] Cache could not be saved:", err);
		}
	}

	// ---------------- Fetch reviews ----------------
	// Scrapes paginated support forum review listings
	async function fetchReviews() {

		let completed = true;
		const reviews = [];
		let page = 4;

		// Month name to number mapping for wp.org date parsing
		const monthsMap = new Map([
			["January", "01"], ["February", "02"], ["March", "03"],
			["April", "04"], ["May", "05"], ["June", "06"],
			["July", "07"], ["August", "08"], ["September", "09"],
			["October", "10"], ["November", "11"], ["December", "12"]
		]);

		const MAX_PAGES = 10;
		const controller = new AbortController();
		const { signal } = controller;

		// Abort when navigating away
		const abortListener = () => controller.abort();
		window.addEventListener("beforeunload", abortListener);

		// Cleanup listener to prevent memory leaks
		const cleanup = () => {
			window.removeEventListener("beforeunload", abortListener);
		};

		async function fetchPage(page) {
			const url = page === 1 ?
				`https://wordpress.org/support/plugin/${slug}/reviews/` :
				`https://wordpress.org/support/plugin/${slug}/reviews/page/${page}/`;

			const res = await fetch(url, { signal });

			if (!res.ok) {
				return null;
			}

			return res.text();
		}

		function processHTML(html) {	// returns true if relevant reviews found
			if (!html) return false;

			const doc = new DOMParser().parseFromString(html, "text/html");
			const topics = [...doc.querySelectorAll('ul[id^="bbp-topic-"]')];
			if (!topics.length) return false;

			let foundRelevant = false;

			for (const topic of topics) {
				const stars = topic.getElementsByClassName("dashicons-star-filled").length;
				const title =
					topic.querySelector(".bbp-topic-freshness a")?.getAttribute("title");
				if (!stars || !title) continue;

				const m = title.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})/);
				if (!m) continue;

				const monthNum = monthsMap.get(m[1]);
				if (!monthNum) continue;

				const key = `${m[3]}-${monthNum}`;
				const date = monthKeyToDate(key);

				if (date >= startMonth && date <= endMonth) {
					reviews.push({
						stars,
						month: key
					});
					foundRelevant = true;
				}
			}

			return foundRelevant;
		}

		let stop = false;

		try {
			// ---------------- Phase 1: Page 1, then pages 2+3 in parallel ----------------
			// --- Step 1: Page 1 alone ---
			const html1 = await fetchPage(1);
			const found1 = processHTML(html1);

			if (!found1) {
				stop = true;
			} else {

				// --- Step 2: Only if page 1 had relevant data ---
				const nextPages = [2, 3].filter(p => p <= MAX_PAGES);
				const nextBatch = await Promise.all(
					nextPages.map(p => fetchPage(p))
				);

				for (let i = 0; i < nextBatch.length; i++) {
					const found = processHTML(nextBatch[i]);
					if (!found) {
						stop = true;
						break;
					}
				}
			}

			// ---------------- Phase 2: Continue fetching in batches of 2 pages ----------------
			while (!stop && page <= MAX_PAGES) {
				const batchPages = [page, page + 1].filter(p => p <= MAX_PAGES);
				const htmlPages = await Promise.all(
					batchPages.map(p => fetchPage(p))
				);

				for (let i = 0; i < htmlPages.length; i++) {
					const found = processHTML(htmlPages[i]);
					if (!found) {
						stop = true;
						break;
					}
				}

				page += 2;
			}
		} catch (err) {
			completed = false;

			if (err.name !== "AbortError") {
				console.error("[RT] Fetch error:", err);
			}
		} finally {
			cleanup();
		}

		if (!completed) return null;
		return reviews;
	}

	// ---------------- Timeline aggregation ----------------
	// Groups reviews by month and computes averages
	function buildTimeline(reviews) {
		const byMonth = {};
		reviews.forEach(r => {
			(byMonth[r.month] ||= []).push(r.stars);
		});

		const timeline = [];
		let d = new Date(startMonth);
		let firstReal = null;

		for (let i = 0; i < 12; i++) {
			const key = monthKey(d);

			if (byMonth[key]) {
				const arr = byMonth[key];
				timeline.push({
					i, 													// month index (0–11)
					avg: arr.reduce((a, b) => a + b, 0) / arr.length, 	// average rating
					count: arr.length, 									// review count
					real: true
				});
				if (firstReal === null) firstReal = i;
			} else {
				timeline.push({
					i,
					avg: null,
					real: false
				});
			}

			d.setMonth(d.getMonth() + 1);
		}

		// Trim leading empty months
		return firstReal === null ? [] : timeline.slice(firstReal);
	}

	// ---------------- Bezier path helper ----------------
	// Creates smooth curve segments between points
	function safeBezier(points) {
		let d = `M ${points[0].x},${points[0].y}`;
		for (let i = 0; i < points.length - 1; i++) {
			const p1 = points[i];
			const p2 = points[i + 1];
			const dx = (p2.x - p1.x) / 3;
			const dy = (p2.y - p1.y) / 12;
			d += ` C ${p1.x + dx},${p1.y + dy}
					 ${p2.x - dx},${p2.y - dy}
					 ${p2.x},${p2.y}`;
		}
		return d;
	}

	// ---------------- Point size scaling ----------------
	// Visual weight reflects number of reviews in that month
	function pointRadius(count) {
		if (count <= 3)  return 6;
		if (count <= 10) return 8;
		if (count <= 20) return 10;
		if (count <= 50) return 12;
		return 14;
	}

	// ---------------- Render ----------------
	function render(timeline) {
		const width = 760,
			height = 340;
		const padL = 50,
			padR = 40,
			padT = 20,
			padB = 110;
		const chartW = width - padL - padR;
		const chartH = height - padT - padB;
		const chartBottom = height - padB;
		const INNER_X_OFFSET = 16;
		const scaleX = i =>
			padL + INNER_X_OFFSET + (i / 11) * (chartW - INNER_X_OFFSET);

		const scaleY = v =>
			height - padB - ((Math.min(5, Math.max(0, v)) - 1) / 4) * chartH;

		// Horizontal grid lines + labels
		const yGrid = [1, 2, 3, 4, 5].map(v => {
			const y = scaleY(v);
			return `
				<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#e5e7eb"/>
				<text x="${padL - 10}" y="${y + 8}" font-size="28" text-anchor="end">${v}</text>
			`;
		}).join("");

		// X-axis month labels
		const axisMonths = [];
		let d = new Date(startMonth);

		for (let i = 0; i < 12; i++) {
			axisMonths.push({ i, date: new Date(d) });
			d.setMonth(d.getMonth() + 1);
		}

		const xLabels = axisMonths.map((m, idx) => {
			const month = m.date.getMonth() + 1;
			const year = m.date.getFullYear();
			const x = scaleX(m.i);

			// Month label
			let monthLabel = `
				<text x="${x}"
					y="${chartBottom + 50}"
					font-size="27"
					text-anchor="middle"
					fill="#111827">
					${month}
				</text>
			`;

			// Year label BELOW months
			let yearLabel = "";

			if (idx === 0 || month === 1) {
				yearLabel = `
				<text x="${x}"
					y="${chartBottom + 80}"
					font-size="22"
					font-weight="600"
					fill="#9CA3AF"
					text-anchor="middle"
					letter-spacing="0.5">
					${year}
				</text>
				`;
			}

			return monthLabel + yearLabel;

		}).join("");

		// Data points
		const pts = timeline.filter(m => m.real).map(m => ({
			x: scaleX(m.i),
			y: scaleY(m.avg),
			idx: m.i
		}));

		// Split into solid vs dashed segments
		const segments = [];
		let current = null;

		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i], b = pts[i + 1];
			const solid = b.idx === a.idx + 1;

			if (!current || current.solid !== solid) {
				if (current) segments.push(current);
				current = {
					solid,
					pts: [a, b]
				};
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

		// Render dots with size based on review count
		const dots = timeline.filter(m => m.real).map(m => `
			<circle
				cx="${scaleX(m.i)}"
				cy="${scaleY(m.avg)}"
				r="${Math.max(pointRadius(m.count), 12)}"
				fill="transparent"
				pointer-events="all">
				<title>&#8960; ${m.avg.toFixed(2)} | ${m.count} ${t.ratings}</title>
			</circle>
			<circle
				cx="${scaleX(m.i)}"
				cy="${scaleY(m.avg)}"
				r="${pointRadius(m.count)}"
				fill="#2563eb"
				opacity="0.9"
				pointer-events="none" />
		`).join("");

		card.innerHTML = `
			${titleHTML}
			<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto">
				${yGrid}
				${paths}
				${dots}
				${xLabels}
			</svg>
			<div style="font-size:16px">${t.scale}</div>
			<div class="rt-footer">
				&copy; <span id="rt-year"></span>
				<a href="https://presskopp.com/" class="rt-footer-link">Presskopp</a> •
				${storeLink}
			</div>
		`;
	}

	// ---------------- Run ----------------
	let reviews = loadCache();

	if (!reviews) {
		reviews = await fetchReviews();

		if (reviews !== null) {
			saveCache(reviews);
		} else {
			reviews = [];
		}
	}

	if (reviews.length < 5) {
		card.innerHTML = `${titleHTML}<div class="rt-content">${t.too_few_reviews}</div>`;
		return;
	}

	render(buildTimeline(reviews));

	const reviewsCountText = t.reviews_last_12
		.replace("{count}", reviews.length);

	const countEl = card.querySelector(".rt-review-count");
	if (countEl) {
		countEl.textContent = reviewsCountText;
	}

	const year = new Date().getFullYear();
	const yearEl = document.getElementById("rt-year");
	if (yearEl) {
		yearEl.textContent = year;
	}

})();
