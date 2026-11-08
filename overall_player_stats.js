async function loadOverallPlayerStats() {
    const container = document.getElementById("overall-player-stats");
    const pageSize = 100;

    const raceTypes = [
        { value: "normal", label: "Normal" },
        { value: "blackout", label: "Blackout" },
        { value: "short", label: "Short" },
        { value: "child", label: "Child" },
        { value: "double", label: "Double" },
        { value: "anti", label: "Anti Bingo" }
    ];

    const columns = [
        { key: "player", label: "Player", type: "text", defaultVisible: true },
        { key: "bingosEntered", label: "Bingos\nEntered", type: "number", defaultVisible: true },
        { key: "completions", label: "Completions", type: "number", defaultVisible: true },
        { key: "forfeits", label: "Forfeits", type: "number", defaultVisible: true },
        { key: "completionPercent", label: "% Complete", type: "number", percent: true, defaultVisible: true },
        { key: "wins", label: "Wins", type: "number", defaultVisible: true },
        { key: "winPercent", label: "Win%", type: "number", percent: true, defaultVisible: true },
        { key: "top3Finishes", label: "Top 3\nFinishes", type: "number", defaultVisible: true },
        { key: "totalTimeSeconds", label: "Total Time", type: "duration", defaultVisible: true },
        { key: "averageTimeSeconds", label: "Average Time", type: "duration", defaultVisible: false },
        { key: "bestTimeSeconds", label: "Best Time", type: "duration", defaultVisible: false },
        { key: "worstTimeSeconds", label: "Worst Time", type: "duration", defaultVisible: false },
        { key: "medianTimeSeconds", label: "Median Time", type: "duration", defaultVisible: false },
        { key: "blanks", label: "Blanks", type: "number", defaultVisible: false },
        { key: "blanksV7Plus", label: "Blanks V7+", type: "number", defaultVisible: false },
        { key: "snipes", label: "Snipes", type: "number", defaultVisible: false },
        { key: "sniped", label: "Sniped", type: "number", defaultVisible: false }
    ];

    let raceData = [];
    let players = [];
    let selectedType = "normal";
    let selectedVersions = new Set();
    let visibleColumns = new Set(
        columns.filter(column => column.defaultVisible).map(column => column.key)
    );
    let sortCriteria = [{ key: "completions", direction: "desc" }];
    let currentPage = 1;

    const number = value => Number(value || 0).toLocaleString();
    const percent = value => Number(value || 0).toFixed(2) + "%";
    const isValidTime = value =>
        typeof value === "number" && Number.isFinite(value);
    const isBlankRowCol = value =>
        value === null ||
        value === undefined ||
        (typeof value === "string" && ["", "---"].includes(value.trim()));

    function isV7OrLater(version) {
        const match = String(version ?? "").match(/\d+/);
        return match !== null && Number(match[0]) >= 7;
    }

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

    function getVisibleColumns() {
        return columns.filter(column => visibleColumns.has(column.key));
    }

    function getValue(player, key) {
        if (key === "completionPercent") {
            return player.bingosEntered
                ? player.completions / player.bingosEntered * 100
                : 0;
        }
        if (key === "winPercent") {
            return player.bingosEntered
                ? player.wins / player.bingosEntered * 100
                : 0;
        }
        return player[key] ?? null;
    }

    function formatCell(player, column) {
        const value = getValue(player, column.key);

        if (column.percent) return percent(value);
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

        // Keep players without a time statistic at the bottom in either sort direction.
        if (valueA === null && valueB !== null) return 1;
        if (valueB === null && valueA !== null) return -1;
        if (valueA === null && valueB === null) return 0;

        let comparison;
        if (criterion.key === "player") {
            comparison = String(valueA).localeCompare(String(valueB), undefined, {
                sensitivity: "base",
                numeric: true
            });
        } else {
            comparison = Number(valueA) - Number(valueB);
        }

        return comparison * (criterion.direction === "asc" ? 1 : -1);
    }

    function getSortedPlayers() {
        return [...players].sort((a, b) => {
            for (const criterion of sortCriteria) {
                const comparison = compareByColumn(a, b, criterion);
                if (comparison !== 0) return comparison;
            }
            return 0;
        });
    }

    function calculatePlayerStats() {
        const playerMap = new Map();
        const filteredRaces = raceData.filter(race =>
            race.type === selectedType && selectedVersions.has(String(race.version))
        );

        function getPlayer(username) {
            if (!playerMap.has(username)) {
                playerMap.set(username, {
                    player: username,
                    bingosEntered: 0,
                    completions: 0,
                    forfeits: 0,
                    wins: 0,
                    top3Finishes: 0,
                    totalTimeSeconds: 0,
                    averageTimeSeconds: null,
                    bestTimeSeconds: null,
                    worstTimeSeconds: null,
                    medianTimeSeconds: null,
                    blanks: 0,
                    blanksV7Plus: 0,
                    snipes: 0,
                    sniped: 0,
                    times: []
                });
            }
            return playerMap.get(username);
        }

        let playerResultCount = 0;

        filteredRaces.forEach(race => {
            const timedPlayers = [];

            (race.players || []).forEach(result => {
                if (!result || typeof result.username !== "string" || !result.username.trim()) {
                    return;
                }

                playerResultCount++;
                const player = getPlayer(result.username);
                player.bingosEntered++;

                const rank = Number(result.rank);
                if (rank === 1) player.wins++;
                if (Number.isFinite(rank) && rank >= 1 && rank <= 3) {
                    player.top3Finishes++;
                }

                if (!isValidTime(result.timeSeconds)) {
                    player.forfeits++;
                    return;
                }

                const time = result.timeSeconds;
                player.completions++;
                player.totalTimeSeconds += time;
                player.times.push(time);
                timedPlayers.push({ username: result.username, timeSeconds: time });

                if (isBlankRowCol(result.rowCol)) {
                    player.blanks++;
                    if (isV7OrLater(race.version)) {
                        player.blanksV7Plus++;
                    }
                }
            });

            // Count each close opponent individually. A player can earn multiple
            // snipes in one race, and a result exactly 10 seconds apart does not count.
            for (let i = 0; i < timedPlayers.length; i++) {
                for (let j = i + 1; j < timedPlayers.length; j++) {
                    const first = timedPlayers[i];
                    const second = timedPlayers[j];
                    const difference = Math.abs(first.timeSeconds - second.timeSeconds);

                    if (difference > 0 && difference < 10) {
                        const faster = first.timeSeconds < second.timeSeconds ? first : second;
                        const slower = faster === first ? second : first;
                        getPlayer(faster.username).snipes++;
                        getPlayer(slower.username).sniped++;
                    }
                }
            }
        });

        players = Array.from(playerMap.values());

        players.forEach(player => {
            player.forfeits = player.bingosEntered - player.completions;

            if (player.completions > 0) {
                player.averageTimeSeconds = player.totalTimeSeconds / player.completions;
                player.times.sort((a, b) => a - b);
                player.bestTimeSeconds = player.times[0];
                player.worstTimeSeconds = player.times[player.times.length - 1];

                const middle = Math.floor(player.times.length / 2);
                player.medianTimeSeconds = player.times.length % 2 === 0
                    ? (player.times[middle - 1] + player.times[middle]) / 2
                    : player.times[middle];
            }

            delete player.times;
        });

        return {
            raceCount: filteredRaces.length,
            playerResultCount
        };
    }

    function buildControls() {
        const controls = makeElement("div", "player-stats-controls");

        const typeGroup = makeElement("div", "player-stats-control-group");
        const typeLabel = makeElement("label", "", "Bingo type");
        typeLabel.htmlFor = "player-stats-type";
        const typeSelect = makeElement("select", "player-stats-select");
        typeSelect.id = "player-stats-type";

        raceTypes.forEach(type => {
            const option = makeElement("option", "", type.label);
            option.value = type.value;
            typeSelect.appendChild(option);
        });

        typeSelect.value = selectedType;
        typeSelect.addEventListener("change", () => {
            selectedType = typeSelect.value;
            const versions = getVersionsForSelectedType();
            selectedVersions = new Set(versions);
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

        columns.filter(column => column.key !== "player").forEach(column => {
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
            const labelText = column.label.replace("\n", " ");
            label.append(checkbox, document.createTextNode(labelText));
            columnOptions.appendChild(label);
        });

        columnGroup.append(columnSummary, columnOptions);
        controls.append(typeGroup, versionGroup, columnGroup);

        container.replaceChildren(controls);
        renderVersionOptions();
        return controls;
    }

    function getVersionsForSelectedType() {
        return [...new Set(
            raceData
                .filter(race => race.type === selectedType)
                .map(race => String(race.version))
        )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }

    function renderVersionOptions() {
        const versionOptions = container.querySelector(".player-stats-version-options");
        versionOptions.replaceChildren();

        const versions = getVersionsForSelectedType();
        const allSelected = versions.length > 0 && versions.every(version => selectedVersions.has(version));

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
        const summaryData = calculatePlayerStats();
        renderVersionOptions();
        render(summaryData);
    }

    function render(summaryData) {
        const visible = getVisibleColumns();
        const sortedPlayers = getSortedPlayers();
        const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pagePlayers = sortedPlayers.slice(startIndex, startIndex + pageSize);

        const tableWrap = makeElement("div", "h2h-table-wrap player-stats-table-wrap");
        const table = makeElement("table", "h2h-table player-stats-table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        visible.forEach(column => {
            const th = document.createElement("th");
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
                    sortCriteria.unshift({
                        key: column.key,
                        direction: column.key === "player" ? "asc" : "desc"
                    });
                    sortCriteria = sortCriteria.slice(0, 2);
                }
                currentPage = 1;
                render(summaryData);
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
                button.title = "Sort priority " + (sortIndex + 1) + ", " + criterion.direction + "ending";
            } else {
                th.setAttribute("aria-sort", "none");
                button.title = "Sort by " + column.label.replace("\n", " ");
            }

            th.appendChild(button);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        pagePlayers.forEach(player => {
            const row = document.createElement("tr");
            visible.forEach(column => {
                const cell = makeElement(
                    "td",
                    column.key === "player" ? "player-stats-name" : "",
                    formatCell(player, column)
                );
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        if (!pagePlayers.length) {
            const row = document.createElement("tr");
            const cell = makeElement("td", "player-stats-empty", "No player statistics were found for these filters.");
            cell.colSpan = visible.length;
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
                render(summaryData);
            });

            const nextButton = makeElement("button", "player-stats-page-button", "Next");
            nextButton.type = "button";
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener("click", () => {
                currentPage++;
                render(summaryData);
            });

            const firstShown = sortedPlayers.length ? startIndex + 1 : 0;
            const lastShown = Math.min(startIndex + pageSize, sortedPlayers.length);
            const pageLabel = makeElement(
                "span",
                "player-stats-page-label",
                "Showing " + number(firstShown) + "–" + number(lastShown) +
                " of " + number(sortedPlayers.length) + " players · Page " +
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

        const sortNote = makeElement(
            "p",
            "h2h-table-note",
            "Select a column heading to sort. Select it again to reverse the sort order. " +
            "The table displays 100 players per page. Close finishes are counted once per opponent " +
            "when the time difference is under 10 seconds."
        );

        const summary = makeElement(
            "p",
            "player-stats-summary",
            number(players.length) + " players · " +
            number(summaryData?.raceCount ?? 0) + " races · " +
            number(summaryData?.playerResultCount ?? 0) + " player entries"
        );

        const controls = container.querySelector(".player-stats-controls");
        container.replaceChildren(controls, summary, topPagination, topScrollbar, tableWrap, bottomPagination, sortNote);

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
        const response = await fetch("player_race_data.json");
        if (!response.ok) throw new Error("Could not load player_race_data.json.");

        const data = await response.json();
        if (!Array.isArray(data.races)) {
            throw new Error('The JSON file does not contain a "races" array.');
        }

        raceData = data.races.filter(race =>
            race &&
            typeof race.type === "string" &&
            Array.isArray(race.players)
        );

        if (!raceData.length) {
            throw new Error("The race data file does not contain any usable races.");
        }

        const availableTypes = new Set(raceData.map(race => race.type));
        if (!availableTypes.has(selectedType)) {
            selectedType = raceTypes.find(type => availableTypes.has(type.value))?.value || "normal";
        }

        selectedVersions = new Set(getVersionsForSelectedType());
        buildControls();
        refresh();
    } catch (error) {
        container.replaceChildren(
            makeElement("p", "h2h-error", "Unable to load overall player statistics."),
            makeElement("p", "h2h-table-note", error.message)
        );
        console.error(error);
    }
}

loadOverallPlayerStats();
