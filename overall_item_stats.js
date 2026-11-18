async function loadOverallItemStats() {
    const container = document.getElementById("overall-item-stats");
    const pageSize = 100;
    const raceTypes = [
        { value: "normal", label: "Normal" },
        { value: "short", label: "Short" },
        { value: "anti", label: "Anti Bingo" }
    ];
    const columns = [
        { key: "item", label: "Item", type: "text", defaultVisible: true },
        { key: "appearances", label: "Appearances", type: "number", defaultVisible: true },
        { key: "used", label: "Used / Picked", type: "number", defaultVisible: true },
        { key: "ratio", label: "Ratio", type: "number", defaultVisible: true },
        { key: "wins", label: "Wins", type: "number", defaultVisible: true },
        { key: "winPercent", label: "Win%", type: "percent", defaultVisible: true },
        { key: "top3Finishes", label: "Top 3 Finishes", type: "number", defaultVisible: false },
        { key: "totalTimeSeconds", label: "Total Time", type: "duration", defaultVisible: false },
        { key: "averageTimeSeconds", label: "Average Time", type: "duration", defaultVisible: false },
        { key: "bestTimeSeconds", label: "Best Time", type: "duration", defaultVisible: false },
        { key: "worstTimeSeconds", label: "Worst Time", type: "duration", defaultVisible: false },
        { key: "medianTimeSeconds", label: "Median Time", type: "duration", defaultVisible: true },
        { key: "under75Minutes", label: "Under 1:15:00", type: "number", defaultVisible: false }
    ];

    let data;
    let items = [];
    let selectedType = "normal";
    let selectedVersions = new Set();
    let visibleColumns = new Set(columns.filter(c => c.defaultVisible).map(c => c.key));
    let sortCriteria = [{ key: "used", direction: "desc" }];
    let currentPage = 1;

    const number = value => Number(value || 0).toLocaleString();
    const percent = value => Number(value || 0).toFixed(2) + "%";

    function formatDuration(totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(Number(totalSeconds))) return "—";
        let remaining = Math.max(0, Math.floor(Number(totalSeconds)));
        const units = [["y", 31536000], ["d", 86400], ["h", 3600], ["m", 60], ["s", 1]];
        const parts = [];
        units.forEach(([label, seconds]) => {
            const amount = Math.floor(remaining / seconds);
            if (amount > 0) {
                parts.push(amount + label);
                remaining %= seconds;
            }
        });
        return parts.join(" ") || "0s";
    }

    function getValue(item, key) {
        if (key === "ratio") return item.appearances ? item.used / item.appearances : 0;
        if (key === "winPercent") return item.used ? item.wins / item.used * 100 : 0;
        return item[key] ?? null;
    }

    function formatCell(item, column) {
        const value = getValue(item, column.key);
        if (column.type === "duration") return formatDuration(value);
        if (column.type === "percent") return percent(value);
        if (column.key === "ratio") return Number(value || 0).toFixed(3);
        if (column.type === "number") return number(value);
        return String(value ?? "");
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function getVersionsForSelectedType() {
        return Object.keys(data.groups[selectedType] || {}).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        );
    }

    function calculateStats() {
        const itemMap = new Map();
        const versions = [...selectedVersions];
        versions.forEach(version => {
            const rows = (data.groups[selectedType] || {})[version] || [];
            rows.forEach(row => {
                if (!itemMap.has(row.item)) {
                    itemMap.set(row.item, {
                        item: row.item, appearances: 0, used: 0, wins: 0,
                        top3Finishes: 0, totalTimeSeconds: 0, times: [],
                        under75Minutes: 0, averageTimeSeconds: null,
                        bestTimeSeconds: null, worstTimeSeconds: null,
                        medianTimeSeconds: null
                    });
                }
                const item = itemMap.get(row.item);
                item.appearances += row.appearances;
                item.used += row.used;
                item.wins += row.wins;
                item.top3Finishes += row.top3Finishes;
                item.totalTimeSeconds += row.totalTimeSeconds;
                item.under75Minutes += row.under75Minutes;
                item.times.push(...row.times);
            });
        });

        items = Array.from(itemMap.values());
        items.forEach(item => {
            if (item.times.length) {
                item.times.sort((a, b) => a - b);
                item.averageTimeSeconds = item.totalTimeSeconds / item.times.length;
                item.bestTimeSeconds = item.times[0];
                item.worstTimeSeconds = item.times[item.times.length - 1];
                const middle = Math.floor(item.times.length / 2);
                item.medianTimeSeconds = item.times.length % 2 === 0
                    ? (item.times[middle - 1] + item.times[middle]) / 2
                    : item.times[middle];
            }
            delete item.times;
        });
    }

    function compare(a, b, criterion) {
        const av = getValue(a, criterion.key);
        const bv = getValue(b, criterion.key);
        if (av === null && bv !== null) return 1;
        if (bv === null && av !== null) return -1;
        if (av === null && bv === null) return 0;
        const result = criterion.key === "item"
            ? String(av).localeCompare(String(bv), undefined, { sensitivity: "base", numeric: true })
            : Number(av) - Number(bv);
        return result * (criterion.direction === "asc" ? 1 : -1);
    }

    function getSortedItems() {
        return [...items].sort((a, b) => {
            for (const criterion of sortCriteria) {
                const result = compare(a, b, criterion);
                if (result) return result;
            }
            return a.item.localeCompare(b.item, undefined, { sensitivity: "base" });
        });
    }

    function buildControls() {
        const controls = makeElement("div", "player-stats-controls");
        const typeGroup = makeElement("div", "player-stats-control-group");
        const typeLabel = makeElement("label", "", "Bingo type");
        typeLabel.htmlFor = "item-stats-type";
        const typeSelect = makeElement("select", "player-stats-select");
        typeSelect.id = "item-stats-type";
        raceTypes.forEach(type => {
            const option = makeElement("option", "", type.label);
            option.value = type.value;
            typeSelect.appendChild(option);
        });
        typeSelect.value = selectedType;
        typeSelect.addEventListener("change", () => {
            selectedType = typeSelect.value;
            selectedVersions = new Set(getVersionsForSelectedType());
            currentPage = 1;
            refresh();
        });
        typeGroup.append(typeLabel, typeSelect);

        const versionGroup = makeElement("div", "player-stats-control-group");
        const versionHeading = makeElement("div", "player-stats-control-label", "Versions");
        const versionOptions = makeElement("div", "player-stats-version-options");
        versionGroup.append(versionHeading, versionOptions);

        const columnGroup = makeElement("details", "player-stats-column-details");
        const columnSummary = makeElement("summary", "", "Choose columns");
        const columnOptions = makeElement("div", "player-stats-column-options");
        columns.filter(column => column.key !== "item").forEach(column => {
            const label = makeElement("label", "player-stats-checkbox");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = visibleColumns.has(column.key);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) visibleColumns.add(column.key);
                else visibleColumns.delete(column.key);
                render();
            });
            label.append(checkbox, document.createTextNode(column.label));
            columnOptions.appendChild(label);
        });
        columnGroup.append(columnSummary, columnOptions);
        controls.append(typeGroup, versionGroup, columnGroup);
        container.replaceChildren(controls);
        renderVersionOptions();
    }

    function isBetaVersion(version) {
        return String(version).toLowerCase().startsWith("beta");
    }

    function renderVersionOptions() {
        const host = container.querySelector(".player-stats-version-options");
        host.replaceChildren();
        const versions = getVersionsForSelectedType();
        const betaVersions = versions.filter(isBetaVersion);
        const regularVersions = versions.filter(version => !isBetaVersion(version));
        const allSelected = versions.length > 0 && versions.every(v => selectedVersions.has(v));

        const allLabel = makeElement("label", "player-stats-checkbox player-stats-all-versions");
        const allCheckbox = document.createElement("input");
        allCheckbox.type = "checkbox";
        allCheckbox.checked = allSelected;
        allCheckbox.addEventListener("change", () => {
            selectedVersions = allCheckbox.checked ? new Set(versions) : new Set();
            currentPage = 1;
            refresh();
        });
        allLabel.append(allCheckbox, document.createTextNode("All versions"));
        host.appendChild(allLabel);

        const versionList = makeElement("div", "player-stats-version-list");
        if (betaVersions.length) {
            const betaLabel = makeElement("label", "player-stats-checkbox");
            const betaCheckbox = document.createElement("input");
            betaCheckbox.type = "checkbox";
            betaCheckbox.checked = betaVersions.every(v => selectedVersions.has(v));
            betaCheckbox.addEventListener("change", () => {
                betaVersions.forEach(v => betaCheckbox.checked ? selectedVersions.add(v) : selectedVersions.delete(v));
                currentPage = 1;
                refresh();
            });
            betaLabel.append(betaCheckbox, document.createTextNode("Beta versions"));
            versionList.appendChild(betaLabel);
        }
        regularVersions.forEach(version => {
            const label = makeElement("label", "player-stats-checkbox");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = selectedVersions.has(version);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) selectedVersions.add(version);
                else selectedVersions.delete(version);
                currentPage = 1;
                refresh();
            });
            label.append(checkbox, document.createTextNode(version));
            versionList.appendChild(label);
        });
        betaVersions.forEach(version => {
            const label = makeElement("label", "player-stats-checkbox");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = selectedVersions.has(version);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) selectedVersions.add(version);
                else selectedVersions.delete(version);
                currentPage = 1;
                refresh();
            });
            label.append(checkbox, document.createTextNode(version));
            versionList.appendChild(label);
        });
        host.appendChild(versionList);
    }

    function render() {
        const sorted = getSortedItems();
        const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
        currentPage = Math.min(currentPage, pageCount);
        const start = (currentPage - 1) * pageSize;
        const pageItems = sorted.slice(start, start + pageSize);
        const visible = columns.filter(column => visibleColumns.has(column.key));

        const summary = makeElement("p", "player-stats-summary",
            number(items.length) + " items | " + number(selectedVersions.size) + " versions selected");
        const topScroll = makeElement("div", "player-stats-top-scrollbar");
        topScroll.setAttribute("aria-label", "Scroll table horizontally");
        const topInner = makeElement("div", "player-stats-top-scrollbar-inner");
        topScroll.appendChild(topInner);

        const tableWrap = makeElement("div", "player-stats-table-wrap");
        const table = makeElement("table", "player-stats-table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        visible.forEach(column => {
            const th = document.createElement("th");
            th.dataset.columnKey = column.key;
            const button = makeElement("button", "player-stats-sort", column.label);
            button.type = "button";
            button.addEventListener("click", () => {
                const existing = sortCriteria.find(c => c.key === column.key);
                if (existing) existing.direction = existing.direction === "asc" ? "desc" : "asc";
                else sortCriteria = [{ key: column.key, direction: "desc" }];
                render();
            });
            const criterion = sortCriteria.find(c => c.key === column.key);
            if (criterion) button.textContent += criterion.direction === "asc" ? " ▲" : " ▼";
            th.appendChild(button);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const tbody = document.createElement("tbody");
        if (!pageItems.length) {
            const row = document.createElement("tr");
            const cell = makeElement("td", "player-stats-empty", "No item statistics match these filters.");
            cell.colSpan = Math.max(1, visible.length);
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            pageItems.forEach(item => {
                const row = document.createElement("tr");
                visible.forEach(column => {
                    const cell = document.createElement("td");
                    cell.textContent = formatCell(item, column);
                    if (column.key === "item") cell.className = "player-stats-name";
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
        }
        table.append(thead, tbody);
        tableWrap.appendChild(table);

        const pagination = makeElement("div", "player-stats-pagination");
        const previous = makeElement("button", "player-stats-page-button", "Previous");
        previous.type = "button";
        previous.disabled = currentPage <= 1;
        previous.addEventListener("click", () => { currentPage--; render(); });
        const label = makeElement("div", "player-stats-page-label",
            "Page " + currentPage + " of " + pageCount + " | Showing " +
            (sorted.length ? start + 1 : 0) + "–" +
            Math.min(start + pageSize, sorted.length) + " of " + number(sorted.length));
        const next = makeElement("button", "player-stats-page-button", "Next");
        next.type = "button";
        next.disabled = currentPage >= pageCount;
        next.addEventListener("click", () => { currentPage++; render(); });
        pagination.append(previous, label, next);

        container.querySelectorAll(".player-stats-summary, .player-stats-top-scrollbar, .player-stats-table-wrap, .player-stats-pagination").forEach(el => el.remove());
        container.append(summary, topScroll, tableWrap, pagination);
        requestAnimationFrame(() => {
            topInner.style.width = table.scrollWidth + "px";
            topScroll.scrollLeft = tableWrap.scrollLeft;
        });
        let syncing = false;
        topScroll.addEventListener("scroll", () => {
            if (syncing) return;
            syncing = true;
            tableWrap.scrollLeft = topScroll.scrollLeft;
            syncing = false;
        });
        tableWrap.addEventListener("scroll", () => {
            if (syncing) return;
            syncing = true;
            topScroll.scrollLeft = tableWrap.scrollLeft;
            syncing = false;
        });
    }

    function refresh() {
        calculateStats();
        renderVersionOptions();
        render();
    }

    try {
        const response = await fetch("overall_item_stats.json");
        if (!response.ok) throw new Error("HTTP " + response.status);
        data = await response.json();
        if (!data.groups) throw new Error("The item statistics JSON is missing its groups data.");
        selectedVersions = new Set(getVersionsForSelectedType());
        buildControls();
        refresh();
    } catch (error) {
        console.error("Could not load overall item statistics:", error);
        container.replaceChildren(makeElement("p", "stats-message",
            "Unable to load overall item statistics. Make sure overall_item_stats.json is in the site folder and has been generated from bingo_races_filtered.json."));
    }
}

document.addEventListener("DOMContentLoaded", loadOverallItemStats);
