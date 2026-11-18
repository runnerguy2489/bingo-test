async function loadOverallItemStats() {
    const container = document.getElementById("overall-item-stats");
    const pageSize = 100;

    const raceTypes = [
        { value: "normal", label: "Normal" },
        { value: "short", label: "Short" },
        { value: "anti", label: "Anti Bingo" }
    ];

    const columns = [
        { key: "appearances", label: "Appearances", type: "number", defaultVisible: true },
        { key: "used", label: "Picked", type: "number", defaultVisible: true },
        { key: "frequency", label: "Frequency", type: "percent", defaultVisible: true },
        { key: "ratio", label: "Ratio", type: "ratio", defaultVisible: true },
        { key: "wins", label: "Wins", type: "number", defaultVisible: true },
        { key: "winPercent", label: "Win%", type: "percent", defaultVisible: true },
        { key: "top3Finishes", label: "Top 3 Finishes", type: "number", defaultVisible: false },
        { key: "totalTimeSeconds", label: "Total Time", type: "duration", defaultVisible: false },
        { key: "averageTimeSeconds", label: "Average Time", type: "duration", defaultVisible: false },
        { key: "bestTimeSeconds", label: "Best Time", type: "duration", defaultVisible: false },
        { key: "worstTimeSeconds", label: "Worst Time", type: "duration", defaultVisible: false },
        { key: "medianTimeSeconds", label: "Median Time", type: "duration", defaultVisible: true },
        { key: "underTarget", label: "Under Target", type: "number", defaultVisible: false }
    ];

    let groups = [];
    let selectedType = "normal";
    let selectedVersions = new Set();
    let visibleColumns = new Set(
        columns.filter(column => column.defaultVisible).map(column => column.key)
    );
    let sortCriteria = [{ key: "appearances", direction: "desc" }];
    let currentPage = 1;
    let items = [];
    let currentSummaryData = { raceCount: 0, boardCount: 0 };
    let underTargetLabel = "Under Target";

    const number = value => Number(value || 0).toLocaleString();
    const percent = value => Number(value || 0).toFixed(2) + "%";

    function formatDuration(totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(Number(totalSeconds))) {
            return "—";
        }

        let remaining = Math.max(0, Math.floor(Number(totalSeconds)));
        const units = [
            ["y", 365 * 24 * 60 * 60],
            ["d", 24 * 60 * 60],
            ["h", 60 * 60],
            ["m", 60],
            ["s", 1]
        ];
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

    function formatClock(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;
        return [hours, minutes, remainder]
            .map(value => String(value).padStart(2, "0"))
            .join(":");
    }

    function getVisibleColumns() {
        return columns.filter(column => visibleColumns.has(column.key));
    }

    function getValue(item, key) {
        if (key === "ratio") {
            return item.appearances ? item.used / item.appearances : 0;
        }
        if (key === "frequency") {
            return currentSummaryData.boardCount
                ? item.appearances / currentSummaryData.boardCount * 100
                : 0;
        }
        if (key === "winPercent") {
            return item.used ? item.wins / item.used * 100 : 0;
        }
        return item[key] ?? null;
    }

    function formatCell(item, column) {
        const value = getValue(item, column.key);

        if (column.type === "percent") return percent(value);
        if (column.type === "ratio") return Number(value || 0).toFixed(2);
        if (column.type === "duration") return formatDuration(value);
        if (column.type === "number") return number(value);
        return String(value ?? "");
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function compareByColumn(a, b, criterion) {
        const valueA = getValue(a, criterion.key);
        const valueB = getValue(b, criterion.key);

        if (valueA === null && valueB !== null) return 1;
        if (valueB === null && valueA !== null) return -1;
        if (valueA === null && valueB === null) return 0;

        let comparison;
        if (criterion.key === "item") {
            comparison = String(valueA).localeCompare(String(valueB), undefined, {
                sensitivity: "base",
                numeric: true
            });
        } else {
            comparison = Number(valueA) - Number(valueB);
        }

        return comparison * (criterion.direction === "asc" ? 1 : -1);
    }

    function getSortedItems() {
        return [...items].sort((a, b) => {
            for (const criterion of sortCriteria) {
                const comparison = compareByColumn(a, b, criterion);
                if (comparison !== 0) return comparison;
            }
            return a.item.localeCompare(b.item, undefined, {
                sensitivity: "base",
                numeric: true
            });
        });
    }

    function calculateItemStats() {
        const itemMap = new Map();
        const filteredGroups = groups.filter(group =>
            group.type === selectedType &&
            selectedVersions.has(String(group.version))
        );

        let raceCount = 0;
        let boardCount = 0;

        filteredGroups.forEach(group => {
            raceCount += Number(group.raceCount || 0);
            boardCount += Number(group.boardCount || 0);

            (group.items || []).forEach(sourceItem => {
                const name = sourceItem.item;
                if (!itemMap.has(name)) {
                    itemMap.set(name, {
                        item: name,
                        appearances: 0,
                        used: 0,
                        wins: 0,
                        top3Finishes: 0,
                        totalTimeSeconds: 0,
                        underTarget: 0,
                        times: []
                    });
                }

                const item = itemMap.get(name);
                item.appearances += Number(sourceItem.appearances || 0);
                item.used += Number(sourceItem.used || 0);
                item.wins += Number(sourceItem.wins || 0);
                item.top3Finishes += Number(sourceItem.top3Finishes || 0);
                item.totalTimeSeconds += Number(sourceItem.totalTimeSeconds || 0);
                item.underTarget += Number(sourceItem.underTarget || 0);

                if (Array.isArray(sourceItem.times)) {
                    sourceItem.times.forEach(time => {
                        if (typeof time === "number" && Number.isFinite(time) && time >= 0) {
                            item.times.push(time);
                        }
                    });
                }
            });
        });

        items = Array.from(itemMap.values());

        items.forEach(item => {
            item.times.sort((a, b) => a - b);
            item.averageTimeSeconds = item.times.length
                ? item.totalTimeSeconds / item.times.length
                : null;
            item.bestTimeSeconds = item.times.length ? item.times[0] : null;
            item.worstTimeSeconds = item.times.length
                ? item.times[item.times.length - 1]
                : null;

            if (item.times.length) {
                const middle = Math.floor(item.times.length / 2);
                item.medianTimeSeconds = item.times.length % 2 === 0
                    ? (item.times[middle - 1] + item.times[middle]) / 2
                    : item.times[middle];
            } else {
                item.medianTimeSeconds = null;
            }

            delete item.times;
        });

        return { raceCount, boardCount };
    }

    function getVersionsForSelectedType() {
        return [...new Set(
            groups
                .filter(group => group.type === selectedType)
                .map(group => String(group.version))
        )].sort((a, b) => a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: "base"
        }));
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
        columnGroup.open = true;
        const columnSummary = makeElement("summary", "", "Choose columns");
        const columnOptions = makeElement("div", "player-stats-column-options");

        columns.forEach(column => {
            const label = makeElement("label", "player-stats-checkbox");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = visibleColumns.has(column.key);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    visibleColumns.add(column.key);
                } else {
                    visibleColumns.delete(column.key);
                }
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

    function renderVersionOptions() {
        const versionOptions = container.querySelector(".player-stats-version-options");
        versionOptions.replaceChildren();

        const versions = getVersionsForSelectedType();
        const allSelected = versions.length > 0 &&
            versions.every(version => selectedVersions.has(version));

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
        versionOptions.appendChild(allLabel);

        const versionList = makeElement("div", "player-stats-version-list");
        versions.forEach(version => {
            const label = makeElement("label", "player-stats-checkbox");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = selectedVersions.has(version);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedVersions.add(version);
                } else {
                    selectedVersions.delete(version);
                }
                currentPage = 1;
                refresh();
            });
            label.append(checkbox, document.createTextNode(version));
            versionList.appendChild(label);
        });

        versionOptions.appendChild(versionList);

        if (!versions.length) {
            versionOptions.appendChild(makeElement("span", "player-stats-muted", "No versions found."));
        }
    }

    function refresh() {
        currentSummaryData = calculateItemStats();
        renderVersionOptions();
        render();
    }

    function render() {
        const summaryData = currentSummaryData;
        const visible = getVisibleColumns();
        const sortedItems = getSortedItems();
        const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageItems = sortedItems.slice(startIndex, startIndex + pageSize);

        const tableWrap = makeElement("div", "h2h-table-wrap player-stats-table-wrap");
        const table = makeElement("table", "h2h-table player-stats-table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const itemHeader = document.createElement("th");
        const itemSortButton = makeElement("button", "player-stats-sort", "Item");
        itemSortButton.type = "button";
        itemSortButton.addEventListener("click", () => {
            const existingIndex = sortCriteria.findIndex(item => item.key === "item");
            if (existingIndex === 0) {
                sortCriteria[0].direction = sortCriteria[0].direction === "asc" ? "desc" : "asc";
            } else {
                sortCriteria.unshift({ key: "item", direction: "asc" });
                sortCriteria = sortCriteria.slice(0, 2);
            }
            currentPage = 1;
            render();
        });
        const itemSortIndex = sortCriteria.findIndex(item => item.key === "item");
        if (itemSortIndex >= 0) {
            const criterion = sortCriteria[itemSortIndex];
            itemSortButton.appendChild(document.createTextNode(criterion.direction === "asc" ? " ▲" : " ▼"));
            if (itemSortIndex > 0) itemSortButton.appendChild(document.createTextNode(" " + (itemSortIndex + 1)));
        }
        itemHeader.appendChild(itemSortButton);
        headerRow.appendChild(itemHeader);

        visible.forEach(column => {
            const th = document.createElement("th");
            th.dataset.columnKey = column.key;
            const button = makeElement("button", "player-stats-sort", column.label);
            button.type = "button";
            button.addEventListener("click", () => {
                const existingIndex = sortCriteria.findIndex(item => item.key === column.key);
                if (existingIndex === 0) {
                    sortCriteria[0].direction = sortCriteria[0].direction === "asc" ? "desc" : "asc";
                } else if (existingIndex > 0) {
                    const [existing] = sortCriteria.splice(existingIndex, 1);
                    sortCriteria.unshift(existing);
                } else {
                    const ascendingFirst = [
                        "averageTimeSeconds",
                        "bestTimeSeconds",
                        "medianTimeSeconds"
                    ].includes(column.key);
                    sortCriteria.unshift({
                        key: column.key,
                        direction: ascendingFirst ? "asc" : "desc"
                    });
                    sortCriteria = sortCriteria.slice(0, 2);
                }
                currentPage = 1;
                render();
            });

            const sortIndex = sortCriteria.findIndex(item => item.key === column.key);
            if (sortIndex >= 0) {
                const criterion = sortCriteria[sortIndex];
                const arrow = criterion.direction === "asc" ? " ▲" : " ▼";
                const priority = sortIndex === 0 ? "" : " " + (sortIndex + 1);
                button.appendChild(document.createTextNode(arrow + priority));
                th.setAttribute("aria-sort", sortIndex === 0
                    ? (criterion.direction === "asc" ? "ascending" : "descending")
                    : "other");
            } else {
                th.setAttribute("aria-sort", "none");
            }

            th.appendChild(button);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        pageItems.forEach(item => {
            const row = document.createElement("tr");
            row.appendChild(makeElement("td", "player-stats-name", item.item));

            visible.forEach(column => {
                row.appendChild(makeElement("td", "", formatCell(item, column)));
            });
            tbody.appendChild(row);
        });

        if (!pageItems.length) {
            const row = document.createElement("tr");
            const cell = makeElement("td", "player-stats-empty", "No item statistics were found for these filters.");
            cell.colSpan = visible.length + 1;
            row.appendChild(cell);
            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        tableWrap.appendChild(table);

        function makePagination() {
            const pagination = makeElement("div", "player-stats-pagination");
            const previousButton = makeElement("button", "player-stats-page-button", "Previous");
            previousButton.type = "button";
            previousButton.disabled = currentPage === 1;
            previousButton.addEventListener("click", () => {
                currentPage--;
                render();
            });

            const nextButton = makeElement("button", "player-stats-page-button", "Next");
            nextButton.type = "button";
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener("click", () => {
                currentPage++;
                render();
            });

            const firstShown = sortedItems.length ? startIndex + 1 : 0;
            const lastShown = Math.min(startIndex + pageSize, sortedItems.length);
            const pageLabel = makeElement(
                "span",
                "player-stats-page-label",
                "Showing " + number(firstShown) + "–" + number(lastShown) +
                " of " + number(sortedItems.length) + " items · Page " +
                number(currentPage) + " of " + number(totalPages)
            );
            pagination.append(previousButton, pageLabel, nextButton);
            return pagination;
        }

        const topPagination = makePagination();
        const bottomPagination = makePagination();

        const topScrollbar = makeElement("div", "player-stats-top-scrollbar");
        topScrollbar.setAttribute("aria-hidden", "true");
        const topScrollbarInner = makeElement("div", "player-stats-top-scrollbar-inner");
        topScrollbar.appendChild(topScrollbarInner);

        const targetSeconds = Number(window.itemStatsTargetSeconds || 0);
        const targetText = targetSeconds ? formatClock(targetSeconds) : "configured target";
        const sortNote = makeElement(
            "p",
            "h2h-table-note",
            "Select a column heading to sort. Select it again to reverse the sort order. " +
            "The table displays 100 items per page. Ratio is Used divided by Appearances; " +
            "Win% is Wins divided by Picked; Frequency is Appearances divided by Boards. Under " +
            (targetSeconds ? underTargetLabel : targetText) +
            " counts completed normal-bingo results only."
        );

        const summary = makeElement(
            "p",
            "player-stats-summary",
            number(sortedItems.length) + " items · " +
            number(summaryData?.raceCount ?? 0) + " races · " +
            number(summaryData?.boardCount ?? 0) + " boards"
        );

        const controls = container.querySelector(".player-stats-controls");
        container.replaceChildren(
            controls,
            summary,
            topPagination,
            topScrollbar,
            tableWrap,
            bottomPagination,
            sortNote
        );

        topScrollbarInner.style.width = table.scrollWidth + "px";
        topScrollbar.addEventListener("scroll", () => {
            if (tableWrap.scrollLeft !== topScrollbar.scrollLeft) {
                tableWrap.scrollLeft = topScrollbar.scrollLeft;
            }
        });
        tableWrap.addEventListener("scroll", () => {
            if (topScrollbar.scrollLeft !== tableWrap.scrollLeft) {
                topScrollbar.scrollLeft = tableWrap.scrollLeft;
            }
        });
    }

    try {
        const response = await fetch("overall_item_stats.json");
        if (!response.ok) throw new Error("Could not load overall_item_stats.json.");

        const data = await response.json();
        if (!Array.isArray(data.groups)) {
            throw new Error('The JSON file does not contain a "groups" array.');
        }

        groups = data.groups.filter(group =>
            group &&
            ["normal", "short", "anti"].includes(group.type) &&
            Array.isArray(group.items)
        );

        if (!groups.length) {
            throw new Error("The item statistics file does not contain any usable normal, short, or anti bingo groups.");
        }

        window.itemStatsTargetSeconds = Number(data.underTargetSeconds) || 0;
        const targetColumn = columns.find(column => column.key === "underTarget");
        if (targetColumn && window.itemStatsTargetSeconds > 0) {
            const targetMinutes = Math.floor(window.itemStatsTargetSeconds / 60);
            const targetHours = Math.floor(targetMinutes / 60);
            const remainingMinutes = targetMinutes % 60;
            underTargetLabel = "<" + (targetHours > 0
                ? targetHours + ":" + String(remainingMinutes).padStart(2, "0")
                : String(targetMinutes));
            targetColumn.label = underTargetLabel;
        }
        selectedVersions = new Set(getVersionsForSelectedType());
        buildControls();
        refresh();
    } catch (error) {
        container.replaceChildren(
            makeElement("p", "h2h-error", "Unable to load overall item statistics."),
            makeElement("p", "h2h-table-note", error.message)
        );
        console.error(error);
    }
}

loadOverallItemStats();
