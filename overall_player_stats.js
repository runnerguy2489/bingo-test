async function loadOverallPlayerStats() {
    const container = document.getElementById("overall-player-stats");
    const pageSize = 100;
    const columns = [
        { key: "player", label: "Player", type: "text" },
        { key: "bingosEntered", label: "Bingos\nEntered", type: "number" },
        { key: "completions", label: "Completions", type: "number" },
        { key: "forfeits", label: "Forfeits", type: "number" },
        { key: "completionPercent", label: "% Complete", type: "number", percent: true },
        { key: "wins", label: "Wins", type: "number" },
        { key: "winPercent", label: "Win%", type: "number", percent: true },
        { key: "top3Finishes", label: "Top 3\nFinishes", type: "number" },
        { key: "totalTimeSeconds", label: "Total Time", type: "number", duration: true }
    ];

    let players = [];
    let sortKey = "player";
    let sortDirection = "asc";
    let currentPage = 1;

    const number = value => Number(value || 0).toLocaleString();
    const percent = value => Number(value || 0).toFixed(2) + "%";

    function formatTotalDuration(totalSeconds) {
        let remaining = Math.max(0, Math.floor(Number(totalSeconds) || 0));
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

    function getValue(player, key) {
        if (key === "completionPercent") {
            if (player.completionPercent !== undefined) return Number(player.completionPercent) || 0;
            return player.bingosEntered
                ? (Number(player.completions) || 0) / Number(player.bingosEntered) * 100
                : 0;
        }
        if (key === "winPercent") {
            if (player.winPercent !== undefined) return Number(player.winPercent) || 0;
            return player.bingosEntered
                ? (Number(player.wins) || 0) / Number(player.bingosEntered) * 100
                : 0;
        }
        return player[key] ?? 0;
    }

    function formatCell(player, column) {
        const value = getValue(player, column.key);
        if (column.percent) return percent(value);
        if (column.duration) return formatTotalDuration(value);
        if (column.type === "number") return number(value);
        return String(value);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function getSortedPlayers() {
        return [...players].sort((a, b) => {
            const valueA = getValue(a, sortKey);
            const valueB = getValue(b, sortKey);
            let comparison;
            if (sortKey === "player") {
                comparison = String(valueA).localeCompare(String(valueB), undefined, {
                    sensitivity: "base",
                    numeric: true
                });
            } else {
                comparison = Number(valueA) - Number(valueB);
            }
            return comparison * (sortDirection === "asc" ? 1 : -1);
        });
    }

    function render() {
        const sortedPlayers = getSortedPlayers();
        const totalPages = Math.max(1, Math.ceil(sortedPlayers.length / pageSize));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pagePlayers = sortedPlayers.slice(startIndex, startIndex + pageSize);

        const tableWrap = makeElement("div", "h2h-table-wrap player-stats-table-wrap");
        const table = makeElement("table", "h2h-table player-stats-table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        columns.forEach(column => {
            const th = document.createElement("th");
            const button = makeElement("button", "player-stats-sort", column.label);
            button.type = "button";
            button.addEventListener("click", () => {
                if (sortKey === column.key) {
                    sortDirection = sortDirection === "asc" ? "desc" : "asc";
                } else {
                    sortKey = column.key;
                    sortDirection = "asc";
                }
                currentPage = 1;
                render();
            });

            if (sortKey === column.key) {
                button.appendChild(document.createTextNode(sortDirection === "asc" ? " ▲" : " ▼"));
                th.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
            } else {
                th.setAttribute("aria-sort", "none");
            }
            th.appendChild(button);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        pagePlayers.forEach(player => {
            const row = document.createElement("tr");
            columns.forEach(column => {
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
            const cell = makeElement("td", "player-stats-empty", "No player statistics were found.");
            cell.colSpan = columns.length;
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
            "Select a column heading to sort. Select it again to reverse the sort order. The table displays 100 players per page."
        );
        container.replaceChildren(topPagination, topScrollbar, tableWrap, bottomPagination, sortNote);

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
        const response = await fetch("overall_player_stats.json");
        if (!response.ok) throw new Error("Could not load overall_player_stats.json.");
        const data = await response.json();
        if (!Array.isArray(data.players)) {
            throw new Error('The JSON file does not contain a "players" array.');
        }

        players = data.players.filter(player =>
            player && typeof player.player === "string"
        );

        const summary = makeElement(
            "p",
            "player-stats-summary",
            number(players.length) + " players · " +
            number(data.raceCount) + " races · " +
            number(data.playerResultCount) + " player entries"
        );
        container.replaceChildren(summary);
        render();
    } catch (error) {
        container.replaceChildren(
            makeElement("p", "h2h-error", "Unable to load overall player statistics."),
            makeElement("p", "h2h-table-note", error.message)
        );
        console.error(error);
    }
}

loadOverallPlayerStats();
