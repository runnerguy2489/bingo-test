async function loadPlayerProfile() {
    const playerInput = document.getElementById("profile-player");
    const clearButton = document.getElementById("profile-clear");
    const suggestions = document.getElementById("profile-player-options");
    const typeSelect = document.getElementById("profile-type");
    const versionsContainer = document.getElementById("profile-versions");
    const status = document.getElementById("profile-status");
    const results = document.getElementById("profile-results");

    const number = value => Number(value || 0).toLocaleString();
    const isValidTime = value => typeof value === "number" && Number.isFinite(value);
    const isBlankRowCol = value =>
        value === null || value === undefined ||
        (typeof value === "string" && ["", "---"].includes(value.trim()));

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function formatDuration(totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(Number(totalSeconds))) return "—";
        let remaining = Math.max(0, Math.floor(Number(totalSeconds)));
        const units = [["y", 31536000], ["d", 86400], ["h", 3600], ["m", 60], ["s", 1]];
        const parts = [];
        for (const [label, seconds] of units) {
            const amount = Math.floor(remaining / seconds);
            if (amount > 0) {
                parts.push(amount + label);
                remaining %= seconds;
            }
        }
        return parts.join(" ") || "0s";
    }

    function formatClock(seconds) {
        if (!Number.isFinite(seconds)) return "—";
        const total = Math.max(0, Math.round(seconds));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` :
            `${m}:${String(s).padStart(2, "0")}`;
    }

    let raceData = [];
    let playerNames = [];
    let selectedPlayer = "";
    let selectedType = "normal";
    let selectedVersions = new Set();

    function racesForFilters() {
        return raceData.filter(race =>
            (selectedType === "all" || race.type === selectedType) &&
            selectedVersions.has(String(race.version))
        );
    }

    function getVersionsForType() {
        return [...new Set(raceData
            .filter(race => selectedType === "all" || race.type === selectedType)
            .map(race => String(race.version)))]
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }

    function isBeta(version) {
        return String(version).toLowerCase().startsWith("beta");
    }

    function renderVersions() {
        versionsContainer.replaceChildren();
        const versions = getVersionsForType();
        const locked = selectedType === "all";
        const beta = versions.filter(isBeta);
        const regular = versions.filter(v => !isBeta(v));

        const allLabel = el("label", "profile-version-all");
        const all = document.createElement("input");
        all.type = "checkbox";
        all.checked = locked || (versions.length > 0 && versions.every(v => selectedVersions.has(v)));
        all.disabled = locked;
        all.addEventListener("change", () => {
            selectedVersions = all.checked ? new Set(versions) : new Set();
            renderVersions();
            renderProfile();
        });
        allLabel.append(all, document.createTextNode(" All versions"));
        versionsContainer.appendChild(allLabel);

        function addVersionCheckbox(labelText, values, checked) {
            const label = el("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = locked || checked;
            checkbox.disabled = locked;
            checkbox.addEventListener("change", () => {
                values.forEach(v => checkbox.checked ? selectedVersions.add(v) : selectedVersions.delete(v));
                renderVersions();
                renderProfile();
            });
            label.append(checkbox, document.createTextNode(" " + labelText));
            versionsContainer.appendChild(label);
        }

        if (beta.length) addVersionCheckbox("Beta versions", beta, beta.every(v => selectedVersions.has(v)));
        regular.forEach(v => addVersionCheckbox(v, [v], selectedVersions.has(v)));
        if (!versions.length) versionsContainer.appendChild(el("span", "profile-muted", "No versions found."));
    }

    function closeSuggestions() {
        suggestions.hidden = true;
        playerInput.setAttribute("aria-expanded", "false");
        playerInput.removeAttribute("aria-activedescendant");
    }

    let visiblePlayers = [];
    let activeIndex = -1;

    function renderSuggestions() {
        const query = playerInput.value.trim().toLocaleLowerCase();
        const matching = playerNames.filter(name => !query || name.toLocaleLowerCase().includes(query));
        visiblePlayers = query ? matching.slice(0, 12) : matching;
        activeIndex = -1;
        suggestions.replaceChildren();

        if (!visiblePlayers.length) {
            suggestions.appendChild(el("li", "profile-no-suggestions", query ? "No matching players" : "No players available"));
        } else {
            visiblePlayers.forEach((name, index) => {
                const option = el("li", "profile-suggestion", name);
                option.id = `profile-player-option-${index}`;
                option.setAttribute("role", "option");
                option.setAttribute("aria-selected", "false");
                option.addEventListener("mousedown", event => event.preventDefault());
                option.addEventListener("click", () => choosePlayer(name));
                suggestions.appendChild(option);
            });
        }
        suggestions.hidden = false;
        playerInput.setAttribute("aria-expanded", "true");
    }

    function highlightSuggestion(index) {
        const options = [...suggestions.querySelectorAll(".profile-suggestion")];
        if (!options.length) return;
        activeIndex = (index + options.length) % options.length;
        options.forEach((option, i) => {
            const active = i === activeIndex;
            option.classList.toggle("active", active);
            option.setAttribute("aria-selected", String(active));
        });
        playerInput.setAttribute("aria-activedescendant", options[activeIndex].id);
        options[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function choosePlayer(name) {
        selectedPlayer = name;
        playerInput.value = name;
        closeSuggestions();
        renderProfile();
    }

    function calculateStats(races, username) {
        const player = {
            bingosEntered: 0, completions: 0, forfeits: 0, wins: 0, top3Finishes: 0,
            totalTimeSeconds: 0, times: [], blanks: 0, snipes: 0, sniped: 0
        };

        races.forEach(race => {
            const timedPlayers = [];
            (race.players || []).forEach(result => {
                if (!result || typeof result.username !== "string" || !result.username.trim()) return;
                if (result.username !== username) {
                    if (isValidTime(result.timeSeconds)) timedPlayers.push({ username: result.username, timeSeconds: result.timeSeconds });
                    return;
                }

                player.bingosEntered++;
                if (!isValidTime(result.timeSeconds)) {
                    player.forfeits++;
                    return;
                }

                const rank = Number(result.rank);
                if (rank === 1) player.wins++;
                if (Number.isFinite(rank) && rank >= 1 && rank <= 3) player.top3Finishes++;
                player.completions++;
                player.totalTimeSeconds += result.timeSeconds;
                player.times.push(result.timeSeconds);
                timedPlayers.push({ username: result.username, timeSeconds: result.timeSeconds });
                if (isBlankRowCol(result.rowCol)) player.blanks++;
            });

            // Match Overall Player Stats: each opponent within (but not exactly) 10 seconds counts.
            const mine = timedPlayers.filter(p => p.username === username);
            mine.forEach(me => {
                timedPlayers.forEach(other => {
                    if (other.username === username) return;
                    const difference = Math.abs(me.timeSeconds - other.timeSeconds);
                    if (difference > 0 && difference < 10) {
                        if (me.timeSeconds < other.timeSeconds) player.snipes++;
                        else player.sniped++;
                    }
                });
            });
        });

        player.forfeits = player.bingosEntered - player.completions;
        player.averageTimeSeconds = player.completions ? player.totalTimeSeconds / player.completions : null;
        player.times.sort((a, b) => a - b);
        player.bestTimeSeconds = player.times.length ? player.times[0] : null;
        player.worstTimeSeconds = player.times.length ? player.times[player.times.length - 1] : null;
        if (player.times.length) {
            const mid = Math.floor(player.times.length / 2);
            player.medianTimeSeconds = player.times.length % 2 === 0
                ? (player.times[mid - 1] + player.times[mid]) / 2 : player.times[mid];
        } else player.medianTimeSeconds = null;
        player.completionPercent = player.bingosEntered ? player.completions / player.bingosEntered * 100 : 0;
        return player;
    }
    function statCard(parent, label, value) {
        const card = el("div", "profile-stat-card");
        card.append(el("div", "profile-stat-label", label), el("div", "profile-stat-value", value));
        parent.appendChild(card);
    }

    function svgNode(tag, attrs = {}) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
        return node;
    }

    function formatBinTime(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        const base = `${hours}:${String(minutes).padStart(2, "0")}`;
        return secs ? `${base}:${String(secs).padStart(2, "0")}` : base;
    }

    function percentile(sorted, fraction) {
        if (!sorted.length) return 0;
        const position = (sorted.length - 1) * fraction;
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        if (lower === upper) return sorted[lower];
        return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
    }

    function drawDistribution(parent, entries) {
        const section = el("section", "profile-section");
        section.appendChild(el("h3", "", "Time Distribution Chart"));
        const card = el("div", "profile-chart-card");
        const completed = entries
            .filter(e => isValidTime(e.result.timeSeconds))
            .map(e => e.result.timeSeconds)
            .sort((a, b) => a - b);
        const forfeits = entries.length - completed.length;

        if (!entries.length) {
            card.appendChild(el("p", "profile-empty", "No race entries for this player with the current filters."));
            section.appendChild(card);
            parent.appendChild(section);
            return;
        }

        if (!completed.length) {
            drawDistributionBars(card, [{ label: "Forfeits", count: forfeits, kind: "forfeit" }]);
            section.appendChild(card);
            parent.appendChild(section);
            return;
        }

        // Normal bingo profiles use the agreed standard time thresholds when
        // the player's results fit that distribution. Other types keep adaptive bins.
        const useNormalThresholds = selectedType === "normal" &&
            completed.some(time => time < 90 * 60) &&
            completed.filter(time => time > 120 * 60).length / completed.length <= 0.25;

        if (useNormalThresholds) {
            const upperBounds = [65, 70, 75, 80, 85, 90, 95, 100, 110, 120].map(m => m * 60);
            const bins = [];
            if (forfeits > 0) bins.push({ label: "Forfeits", count: forfeits, kind: "forfeit" });
            let lowerBound = 0;
            upperBounds.forEach((upperBound, index) => {
                const count = completed.filter(time => time >= lowerBound && time < upperBound).length;
                bins.push({
                    label: `<${formatBinTime(upperBound)}`,
                    count,
                    kind: "normal",
                    colorIndex: index
                });
                lowerBound = upperBound;
            });
            const overflowCount = completed.filter(time => time >= 120 * 60).length;
            if (overflowCount > 0) {
                bins.push({
                    label: "2:00+",
                    count: overflowCount,
                    kind: "normal",
                    colorIndex: upperBounds.length
                });
            }
            drawDistributionBars(card, bins, 300);
            section.appendChild(card);
            parent.appendChild(section);
            return;
        }

        // Use fixed-width bins, increasing the interval only as needed to keep
        // the regular distribution to about 12 bins. Forfeit and overflow bins
        // may add one or two more when those categories are present.
        const intervals = [150, 300, 600, 1200]; // 2.5, 5, 10, or 20 minutes
        const p90 = percentile(completed, 0.90);
        let interval = intervals[intervals.length - 1];
        let firstBinIndex = Math.floor(completed[0] / interval);
        let overflowBinIndex = Math.floor(p90 / interval);
        if (overflowBinIndex <= firstBinIndex) overflowBinIndex = firstBinIndex + 1;

        for (const candidate of intervals) {
            const first = Math.floor(completed[0] / candidate);
            let overflow = Math.floor(p90 / candidate);
            if (overflow <= first) overflow = first + 1;
            if (overflow - first <= 12) {
                interval = candidate;
                firstBinIndex = first;
                overflowBinIndex = overflow;
                break;
            }
        }

        const counts = new Map();
        let overflowCount = 0;
        completed.forEach(time => {
            const binIndex = Math.floor(time / interval);
            if (binIndex >= overflowBinIndex) {
                overflowCount++;
            } else {
                counts.set(binIndex, (counts.get(binIndex) || 0) + 1);
            }
        });

        const bins = [];
        if (forfeits > 0) bins.push({ label: "Forfeits", count: forfeits, kind: "forfeit" });

        // Each label is an exclusive upper bound: "<1:15" includes all times
        // below 1:15; "<1:17:30" includes 1:15 through 1:17:29.
        for (let index = firstBinIndex; index < overflowBinIndex; index++) {
            const upperBound = (index + 1) * interval;
            bins.push({
                label: `<${formatBinTime(upperBound)}`,
                count: counts.get(index) || 0,
                kind: "normal",
                colorIndex: index - firstBinIndex
            });
        }

        if (overflowCount > 0) {
            bins.push({
                label: `${formatBinTime(overflowBinIndex * interval)}+`,
                count: overflowCount,
                kind: "normal",
                colorIndex: overflowBinIndex - firstBinIndex
            });
        }

        drawDistributionBars(card, bins, interval);
        section.appendChild(card);
        parent.appendChild(section);
    }

    function drawDistributionBars(card, bins, interval) {
        // Keep the chart compact per bin. Bars fill their slots edge-to-edge,
        // so alternating colors distinguish adjacent bins without white gaps.
        const width = Math.max(700, bins.length * 52 + 76), height = 370;
        const left = 58, right = 18, top = 24, bottom = 126;
        const plotW = width - left - right, plotH = height - top - bottom;
        const peak = Math.max(1, ...bins.map(bin => bin.count));
        const svg = svgNode("svg", {
            viewBox: `0 0 ${width} ${height}`,
            class: "profile-chart",
            role: "img",
            "aria-label": "Bingo count by completion-time bins. Labels are exclusive upper bounds; forfeit results are shown first."
        });

        for (let tick = 0; tick <= 4; tick++) {
            const y = top + plotH - plotH * tick / 4;
            svg.appendChild(svgNode("line", {
                x1: left, y1: y, x2: width - right, y2: y,
                stroke: "currentColor", "stroke-opacity": ".16"
            }));
            const label = svgNode("text", {
                x: left - 9, y: y + 4, "text-anchor": "end",
                fill: "currentColor", "font-size": 13
            });
            label.textContent = String(Math.round(peak * tick / 4));
            svg.appendChild(label);
        }

        const slot = plotW / bins.length;
        bins.forEach((bin, index) => {
            const barW = slot;
            const barH = bin.count / peak * plotH;
            const x = left + index * slot;
            const y = top + plotH - barH;
            let fill;
            if (bin.kind === "forfeit") fill = "#9b6b45";
            else fill = (bin.colorIndex ?? index) % 2 === 0 ? "#3979ad" : "#c5a64b";
            svg.appendChild(svgNode("rect", { x, y, width: barW, height: barH, rx: 0, fill }));

            const count = svgNode("text", {
                x: x + barW / 2, y: Math.max(top + 13, y - 7),
                "text-anchor": "middle", fill: "currentColor", "font-size": 12,
                "font-weight": "600"
            });
            count.textContent = String(bin.count);
            svg.appendChild(count);

            const labelX = left + index * slot + slot / 2;
            const labelY = top + plotH + 20;
            const xLabel = svgNode("text", {
                x: labelX, y: labelY,
                "text-anchor": "end", fill: "currentColor", "font-size": 12
            });
            xLabel.textContent = bin.label;
            xLabel.setAttribute("transform", `rotate(-48 ${labelX} ${labelY})`);
            svg.appendChild(xLabel);
        });

        const yTitle = svgNode("text", {
            x: 14, y: top + plotH / 2,
            transform: `rotate(-90 14 ${top + plotH / 2})`,
            "text-anchor": "middle", fill: "currentColor", "font-size": 13
        });
        yTitle.textContent = "Number of bingos";
        svg.appendChild(yTitle);

        const wrap = el("div", "profile-chart-wrap");
        wrap.appendChild(svg);
        card.appendChild(wrap);
        const intervalLabel = interval ? `${interval / 60}-minute regular bins.` : "";
        card.appendChild(el("p", "profile-muted",
            `${intervalLabel} Bin labels show exclusive upper limits (for example, <1:17:30 includes times from 1:15:00 through 1:17:29). Empty bins within the distribution are retained; the slowest group is shown as a time+ bin.`));
    }

    function drawRecentTimes(parent, entries) {
        const section = el("section", "profile-section");
        section.appendChild(el("h3", "", "Recent Performance — Last 50 Races"));
        const card = el("div", "profile-chart-card");
        const recent = entries.slice().sort((a, b) =>
            (Date.parse(a.race.date || "") || 0) - (Date.parse(b.race.date || "") || 0) ||
            Number(a.race.raceId || 0) - Number(b.race.raceId || 0)
        ).slice(-50);

        if (!recent.length) {
            card.appendChild(el("p", "profile-empty", "No race entries for this player with the current filters."));
            section.appendChild(card);
            parent.appendChild(section);
            return;
        }

        const points = recent.map((entry, index) => ({
            x: index,
            y: isValidTime(entry.result.timeSeconds) ? entry.result.timeSeconds : null
        }));
        const valid = points.filter(p => p.y !== null);
        if (!valid.length) {
            card.appendChild(el("p", "profile-empty", "The player's last 50 filtered races contain no completed times."));
            section.appendChild(card);
            parent.appendChild(section);
            return;
        }

        const width = Math.max(760, recent.length * 20 + 100), height = 390;
        const left = 68, right = 24, top = 24, bottom = 64;
        const plotW = width - left - right, plotH = height - top - bottom;
        const minY = Math.min(...valid.map(p => p.y));
        const maxY = Math.max(...valid.map(p => p.y));
        const pad = Math.max(300, (maxY - minY) * .12);
        const low = Math.max(0, minY - pad), high = maxY + pad;
        const x = i => left + (recent.length <= 1 ? .5 : i / (recent.length - 1)) * plotW;
        const y = v => top + (high - v) / (high - low || 1) * plotH;

        const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, class: "profile-chart", role: "img", "aria-label": "Completion times across the player's last 50 races, with overall trend and five-race moving average." });
        for (let tick = 0; tick <= 4; tick++) {
            const value = low + (high - low) * tick / 4;
            const yy = y(value);
            svg.appendChild(svgNode("line", { x1: left, y1: yy, x2: width - right, y2: yy, stroke: "currentColor", "stroke-opacity": ".16" }));
            const label = svgNode("text", { x: left - 8, y: yy + 4, "text-anchor": "end", fill: "currentColor", "font-size": 12 });
            label.textContent = formatClock(value);
            svg.appendChild(label);
        }

        // Overall least-squares trend against race index (completed results only).
        const meanX = valid.reduce((s, p) => s + p.x, 0) / valid.length;
        const meanY = valid.reduce((s, p) => s + p.y, 0) / valid.length;
        const denominator = valid.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
        const slope = denominator ? valid.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / denominator : 0;
        const intercept = meanY - slope * meanX;
        svg.appendChild(svgNode("line", { x1: x(0), y1: y(intercept), x2: x(recent.length - 1), y2: y(intercept + slope * (recent.length - 1)), stroke: "#d97706", "stroke-width": 2.5, "stroke-dasharray": "7 5" }));

        // Five-completion moving average, retaining race order and skipping forfeits.
        const moving = [];
        let window = [];
        points.forEach(point => {
            if (point.y !== null) window.push(point.y);
            if (window.length > 5) window.shift();
            if (point.y !== null && window.length === 5) {
                moving.push({ x: point.x, y: window.reduce((a, b) => a + b, 0) / window.length });
            }
        });
        if (moving.length) {
            const path = moving.map((p, i) => `${i ? "L" : "M"} ${x(p.x)} ${y(p.y)}`).join(" ");
            svg.appendChild(svgNode("path", { d: path, fill: "none", stroke: "#15966b", "stroke-width": 3 }));
        }

        points.forEach(p => {
            if (p.y === null) {
                svg.appendChild(svgNode("path", { d: `M ${x(p.x)-3} ${top+plotH+7} l 6 6 m -6 0 l 6 -6`, stroke: "#9b6b45", "stroke-width": 1.5 }));
            } else {
                svg.appendChild(svgNode("circle", { cx: x(p.x), cy: y(p.y), r: 3.2, fill: "#3979ad" }));
            }
        });

        const xTitle = svgNode("text", { x: left + plotW / 2, y: height - 8, "text-anchor": "middle", fill: "currentColor", "font-size": 12 });
        xTitle.textContent = "Race order (oldest on the left)";
        svg.appendChild(xTitle);
        const yTitle = svgNode("text", { x: 15, y: top + plotH / 2, transform: `rotate(-90 15 ${top + plotH / 2})`, "text-anchor": "middle", fill: "currentColor", "font-size": 12 });
        yTitle.textContent = "Completion time";
        svg.appendChild(yTitle);

        const wrap = el("div", "profile-chart-wrap");
        wrap.appendChild(svg);
        card.appendChild(wrap);
        const legend = el("div", "profile-chart-legend");
        legend.innerHTML = '<span><i class="profile-legend-line" style="color:#3979ad"></i>Race times</span><span><i class="profile-legend-line" style="color:#d97706;border-top-style:dashed"></i>Overall trend</span><span><i class="profile-legend-line" style="color:#15966b"></i>5-completion moving average</span><span>× Forfeit</span>';
        card.appendChild(legend);
        card.appendChild(el("p", "profile-muted", `${recent.length} most recent race entries are shown, ordered oldest to newest. Forfeits are marked on the bottom axis; trend calculations use completed races only.`));
        section.appendChild(card);
        parent.appendChild(section);
    }
    function drawTopItems(parent, entries) {
        const counts = new Map();
        entries.forEach(entry => {
            (entry.result.selectedItems || []).forEach(item => {
                if (typeof item === "string" && item.trim()) counts.set(item, (counts.get(item) || 0) + 1);
            });
        });
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
        const section = el("section", "profile-section");
        section.appendChild(el("h3", "", "Top 5 Item Choices"));
        if (!top.length) {
            section.appendChild(el("p", "profile-muted", "No recorded item selections for this player under the current filters."));
            parent.appendChild(section);
            return;
        }
        const table = el("table", "profile-items-table");
        const thead = document.createElement("thead");
        const header = document.createElement("tr");
        header.append(el("th", "", "Selected goal"), el("th", "", "Times selected"));
        thead.appendChild(header);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        top.forEach(([item, count], index) => {
            const row = document.createElement("tr");
            row.append(el("td", "", `${index + 1}. ${item}`), el("td", "", number(count)));
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        parent.appendChild(section);
    }

    function renderProfile() {
        results.replaceChildren();
        if (!selectedPlayer) {
            status.textContent = "Select a player to view their profile.";
            return;
        }

        const races = racesForFilters();
        const entries = [];
        races.forEach(race => {
            (race.players || []).forEach(result => {
                if (result && result.username === selectedPlayer) entries.push({ race, result });
            });
        });

        const stats = calculateStats(races, selectedPlayer);
        status.textContent = `${selectedPlayer} · ${number(entries.length)} race entries · ${number(races.length)} races included by filters`;

        const overview = el("div", "profile-overview-layout");
        const statGrid = el("div", "profile-stat-grid");
        const statValues = [
            ["Bingos Entered", number(stats.bingosEntered)],
            ["Completed", number(stats.completions)],
            ["Forfeits", number(stats.forfeits)],
            ["Completion Percentage", stats.completionPercent.toFixed(2) + "%"],
            ["Wins", number(stats.wins)],
            ["Top 3 Finishes", number(stats.top3Finishes)],
            ["Total Time", formatDuration(stats.totalTimeSeconds)],
            ["Best Time", formatDuration(stats.bestTimeSeconds)],
            ["Worst Time", formatDuration(stats.worstTimeSeconds)],
            ["Average Time", formatDuration(stats.averageTimeSeconds)],
            ["Median Time", formatDuration(stats.medianTimeSeconds)],
            ["Blanks", number(stats.blanks)],
            ["Snipes", number(stats.snipes)],
            ["Sniped", number(stats.sniped)]
        ];
        statValues.forEach(([label, value]) => statCard(statGrid, label, value));
        overview.appendChild(statGrid);
        drawTopItems(overview, entries);
        results.appendChild(overview);

        drawDistribution(results, entries);
        drawRecentTimes(results, entries);
    }

    try {
        const response = await fetch("player_profile_stats.json");
        if (!response.ok) throw new Error("Could not load player_profile_stats.json.");
        const data = await response.json();
        if (!Array.isArray(data.races)) throw new Error('The JSON file does not contain a "races" array.');

        raceData = data.races.filter(race => race && typeof race.type === "string" && Array.isArray(race.players));
        const names = new Set();
        raceData.forEach(race => race.players.forEach(player => {
            if (player && typeof player.username === "string" && player.username.trim()) names.add(player.username);
        }));
        playerNames = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));

        const availableTypes = new Set(raceData.map(race => race.type));
        if (!availableTypes.has(selectedType)) selectedType = [...availableTypes][0] || "all";
        typeSelect.value = selectedType;
        selectedVersions = new Set(getVersionsForType());
        renderVersions();

        playerInput.addEventListener("focus", renderSuggestions);
        playerInput.addEventListener("input", () => {
            selectedPlayer = "";
            renderSuggestions();
            renderProfile();
        });
        playerInput.addEventListener("keydown", event => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (suggestions.hidden) renderSuggestions();
                highlightSuggestion(activeIndex + 1);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                if (suggestions.hidden) renderSuggestions();
                highlightSuggestion(activeIndex - 1);
            } else if (event.key === "Enter" && !suggestions.hidden && activeIndex >= 0) {
                event.preventDefault();
                choosePlayer(visiblePlayers[activeIndex]);
            } else if (event.key === "Escape") closeSuggestions();
        });
        clearButton.addEventListener("click", () => {
            playerInput.value = "";
            selectedPlayer = "";
            closeSuggestions();
            playerInput.focus();
            renderProfile();
        });
        document.addEventListener("click", event => {
            if (!event.target.closest(".profile-player-select")) closeSuggestions();
        });

        typeSelect.addEventListener("change", () => {
            selectedType = typeSelect.value;
            selectedVersions = new Set(getVersionsForType());
            renderVersions();
            renderProfile();
        });

        status.textContent = `Loaded ${number(data.raceCount ?? raceData.length)} races and ${number(playerNames.length)} players. Select a player to view their profile.`;
        renderProfile();
    } catch (error) {
        status.textContent = "Unable to load player profile data.";
        results.replaceChildren(el("p", "h2h-error", error.message));
        console.error(error);
    }
}

loadPlayerProfile();