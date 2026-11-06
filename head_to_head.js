async function loadHeadToHead() {
    const playerOneInput = document.getElementById("player-one");
    const playerTwoInput = document.getElementById("player-two");
    const normalOnlyCheckbox = document.getElementById("normal-only");
    const status = document.getElementById("h2h-status");
    const resultsContainer = document.getElementById("h2h-results");

    const number = value => Number(value).toLocaleString();

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = text;
        return element;
    }

    function formatDate(value) {
        if (!value) return "Unknown date";
        const date = new Date(`${value}Z`);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC"
        });
    }

    function formatTimeDifference(seconds) {
        const total = Math.abs(Math.round(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const remainingSeconds = total % 60;
        const parts = [];
        if (hours) parts.push(`${hours}h`);
        if (minutes || hours) parts.push(`${minutes}m`);
        parts.push(`${remainingSeconds}s`);
        return parts.join(" ");
    }

    function safeRaceUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
        } catch {
            return null;
        }
    }

    function addRaceLink(parent, race, label = "View race") {
        const url = safeRaceUrl(race.raceUrl);
        if (!url) {
            parent.appendChild(makeElement("span", "", "—"));
            return;
        }
        const link = makeElement("a", "h2h-race-link", label);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        parent.appendChild(link);
    }

    function playerResult(race, username) {
        return race.players.find(player => player.username === username);
    }

    function getOutcome(one, two) {
        const oneForfeited = one.timeSeconds === null || one.timeSeconds === undefined;
        const twoForfeited = two.timeSeconds === null || two.timeSeconds === undefined;

        if (oneForfeited && twoForfeited) return "tie";
        if (oneForfeited) return "two";
        if (twoForfeited) return "one";

        const oneRank = Number(one.rank);
        const twoRank = Number(two.rank);
        if (Number.isFinite(oneRank) && Number.isFinite(twoRank) && oneRank !== twoRank) {
            return oneRank < twoRank ? "one" : "two";
        }

        const oneTime = Number(one.timeSeconds);
        const twoTime = Number(two.timeSeconds);
        if (Number.isFinite(oneTime) && Number.isFinite(twoTime) && oneTime !== twoTime) {
            return oneTime < twoTime ? "one" : "two";
        }

        return "tie";
    }

    function getSameLine(one, two) {
        // A matching row, column, or diagonal means both players selected
        // the same five squares. Ignore formatting differences in the source.
        const normalizeLine = value => String(value || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");

        const lineOne = normalizeLine(one.rowCol);
        const lineTwo = normalizeLine(two.rowCol);

        if (!lineOne || !lineTwo || lineOne === "---" || lineTwo === "---") {
            return false;
        }

        return lineOne === lineTwo;
    }

    function appendSummaryCard(parent, label, value, detail) {
        const card = makeElement("section", "stat-card h2h-stat-card");
        card.append(
            makeElement("div", "stat-label", label),
            makeElement("div", "stat-value", value)
        );
        if (detail) card.appendChild(makeElement("div", "stat-detail", detail));
        parent.appendChild(card);
    }

    function buildHighlight(title, match, playerOne, playerTwo, kind) {
        const section = makeElement("section", "h2h-highlight");
        section.appendChild(makeElement("h3", "", title));

        if (!match) {
            section.appendChild(makeElement("p", "h2h-muted", "No eligible completed matches."));
            return section;
        }

        const outcomeText = match.outcome === "tie"
            ? "Tie"
            : match.outcome === "one" ? playerOne : playerTwo;
        section.appendChild(makeElement("div", "h2h-highlight-result", outcomeText));

        const details = makeElement("p", "h2h-highlight-detail");
        details.textContent = `${formatDate(match.race.date)} · ${playerOne}: ${match.one.time} · ${playerTwo}: ${match.two.time}`;
        section.appendChild(details);

        if (kind === "closest") {
            section.appendChild(makeElement("p", "h2h-highlight-detail", `Time difference: ${formatTimeDifference(match.difference)}`));
        } else if (match.outcome === "tie") {
            section.appendChild(makeElement("p", "h2h-highlight-detail", "Both players forfeited or recorded the same rank."));
        } else {
            const winner = match.outcome === "one" ? match.one : match.two;
            const loser = match.outcome === "one" ? match.two : match.one;
            section.appendChild(makeElement("p", "h2h-highlight-detail", `Margin by finish time: ${winner.timeSeconds != null && loser.timeSeconds != null ? formatTimeDifference(Math.abs(winner.timeSeconds - loser.timeSeconds)) : "Not available"}`));
        }

        const linkWrap = makeElement("div", "h2h-highlight-link");
        addRaceLink(linkWrap, match.race);
        section.appendChild(linkWrap);
        return section;
    }

    function renderTable(matches, playerOne, playerTwo) {
        const section = makeElement("section", "h2h-table-section");
        section.appendChild(makeElement("h3", "", "All Head-to-Head Races"));

        if (!matches.length) {
            section.appendChild(makeElement("p", "h2h-muted", "These players have no races together with the current filter."));
            return section;
        }

        const wrapper = makeElement("div", "h2h-table-wrap");
        const table = makeElement("table", "h2h-table");
        const headers = ["Date", "Winner", "Loser", "Winner Time", "Loser Time", "Winner Row/Col", "Loser Row/Col", "Type", "Version", "Race"];
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headers.forEach(label => headerRow.appendChild(makeElement("th", "", label)));
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        matches.forEach(match => {
            const row = document.createElement("tr");
            let winnerName;
            let loserName;
            let winnerResult;
            let loserResult;

            if (match.outcome === "one") {
                winnerName = playerOne;
                loserName = playerTwo;
                winnerResult = match.one;
                loserResult = match.two;
            } else if (match.outcome === "two") {
                winnerName = playerTwo;
                loserName = playerOne;
                winnerResult = match.two;
                loserResult = match.one;
            } else {
                // Keep each tied player's own result details in their respective columns.
                winnerName = "Tie";
                loserName = "Tie";
                winnerResult = match.one;
                loserResult = match.two;
            }

            const displayTime = result =>
                result.timeSeconds === null || result.timeSeconds === undefined
                    ? "forfeit"
                    : (result.time || "—");

            const values = [
                formatDate(match.race.date),
                winnerName,
                loserName,
                displayTime(winnerResult),
                displayTime(loserResult),
                winnerResult.rowCol || "—",
                loserResult.rowCol || "—",
                match.race.type || "Unknown",
                match.race.version || "—"
            ];

            values.forEach((value, index) => {
                const cell = makeElement("td", index === 1 && match.outcome === "one" ? "h2h-player-one" :
                    index === 1 && match.outcome === "two" ? "h2h-player-two" :
                    index === 1 ? "h2h-tie" : "", value);
                row.appendChild(cell);
            });

            const linkCell = document.createElement("td");
            addRaceLink(linkCell, match.race, "Results");
            row.appendChild(linkCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        wrapper.appendChild(table);
        section.appendChild(wrapper);
        section.appendChild(makeElement("p", "h2h-table-note", "For a tie, both players forfeited or have the same recorded rank. Matching row, column, or diagonal selections mean both players chose the same five squares."));
        return section;
    }

    try {
        const response = await fetch("head_to_head.json");
        if (!response.ok) throw new Error("Could not load head_to_head.json.");
        const data = await response.json();

        if (!Array.isArray(data.races) || !Array.isArray(data.players)) {
            throw new Error("The head-to-head JSON is missing its races or players array.");
        }

        const players = [...data.players].sort((a, b) => a.localeCompare(b));
        let selectedPlayerOne = "";
        let selectedPlayerTwo = "";

        function setupAutocomplete(input, playerKey, getOtherPlayer, setSelectedPlayer) {
            const wrapper = input.closest(".h2h-autocomplete");
            const list = wrapper.querySelector(".h2h-suggestions");
            const clearButton = wrapper.querySelector(".h2h-clear");
            let activeIndex = -1;
            let visiblePlayers = [];

            function closeSuggestions() {
                list.hidden = true;
                input.setAttribute("aria-expanded", "false");
                input.removeAttribute("aria-activedescendant");
                activeIndex = -1;
            }

            function renderSuggestions() {
                const query = input.value.trim().toLocaleLowerCase();
                const otherPlayer = getOtherPlayer();
                visiblePlayers = players
                    .filter(username => username !== otherPlayer &&
                        (!query || username.toLocaleLowerCase().includes(query)))
                    .slice(0, 12);
                list.replaceChildren();
                activeIndex = -1;

                if (!visiblePlayers.length) {
                    const empty = document.createElement("li");
                    empty.className = "h2h-no-suggestions";
                    empty.textContent = query ? "No matching players" : "No players available";
                    empty.setAttribute("role", "option");
                    list.appendChild(empty);
                } else {
                    visiblePlayers.forEach((username, index) => {
                        const option = document.createElement("li");
                        option.id = `${input.id}-option-${index}`;
                        option.className = "h2h-suggestion";
                        option.textContent = username;
                        option.setAttribute("role", "option");
                        option.setAttribute("aria-selected", "false");
                        option.addEventListener("mousedown", event => event.preventDefault());
                        option.addEventListener("click", () => choosePlayer(username));
                        list.appendChild(option);
                    });
                }

                list.hidden = false;
                input.setAttribute("aria-expanded", "true");
            }

            function highlightSuggestion(index) {
                const options = list.querySelectorAll(".h2h-suggestion");
                if (!options.length) return;
                activeIndex = (index + options.length) % options.length;
                options.forEach((option, optionIndex) => {
                    const active = optionIndex === activeIndex;
                    option.setAttribute("aria-selected", String(active));
                    option.classList.toggle("active", active);
                });
                input.setAttribute("aria-activedescendant", options[activeIndex].id);
                options[activeIndex].scrollIntoView({ block: "nearest" });
            }

            function choosePlayer(username) {
                setSelectedPlayer(username);
                input.value = username;
                closeSuggestions();
                renderComparison();
            }

            input.addEventListener("focus", renderSuggestions);
            input.addEventListener("input", () => {
                setSelectedPlayer("");
                renderSuggestions();
                renderComparison();
            });
            input.addEventListener("keydown", event => {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    if (list.hidden) renderSuggestions();
                    highlightSuggestion(activeIndex + 1);
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (list.hidden) renderSuggestions();
                    highlightSuggestion(activeIndex - 1);
                } else if (event.key === "Enter" && !list.hidden && activeIndex >= 0) {
                    event.preventDefault();
                    choosePlayer(visiblePlayers[activeIndex]);
                } else if (event.key === "Escape") {
                    closeSuggestions();
                }
            });
            clearButton.addEventListener("click", () => {
                input.value = "";
                setSelectedPlayer("");
                closeSuggestions();
                input.focus();
                renderComparison();
            });
            document.addEventListener("click", event => {
                if (!wrapper.contains(event.target)) closeSuggestions();
            });
        }

        setupAutocomplete(playerOneInput, "one", () => selectedPlayerTwo, value => { selectedPlayerOne = value; });
        setupAutocomplete(playerTwoInput, "two", () => selectedPlayerOne, value => { selectedPlayerTwo = value; });

        status.textContent = `Loaded ${number(data.raceCount ?? data.races.length)} races and ${number(data.uniquePlayerCount ?? players.length)} players. Search for two players to compare.`;

        function renderComparison() {
            const playerOne = selectedPlayerOne;
            const playerTwo = selectedPlayerTwo;
            resultsContainer.replaceChildren();

            if (!playerOne || !playerTwo) {
                status.textContent = `Loaded ${number(data.raceCount ?? data.races.length)} races. Select both players to see their head-to-head results.`;
                return;
            }

            if (playerOne === playerTwo) {
                status.textContent = "Please select two different players.";
                return;
            }

            const filteredRaces = data.races.filter(race =>
                !normalOnlyCheckbox.checked || String(race.type || "").toLowerCase() === "normal"
            );

            const matches = [];
            filteredRaces.forEach(race => {
                const one = playerResult(race, playerOne);
                const two = playerResult(race, playerTwo);
                if (!one || !two) return;

                matches.push({
                    race,
                    one,
                    two,
                    outcome: getOutcome(one, two)
                });
            });

            matches.sort((a, b) => {
                const dateDifference = new Date(`${b.race.date}Z`).getTime() - new Date(`${a.race.date}Z`).getTime();
                return dateDifference || Number(b.race.raceId) - Number(a.race.raceId);
            });

            let oneWins = 0;
            let twoWins = 0;
            let ties = 0;
            let oneSameLineWins = 0;
            let twoSameLineWins = 0;

            matches.forEach(match => {
                if (match.outcome === "one") oneWins++;
                else if (match.outcome === "two") twoWins++;
                else ties++;

                if (getSameLine(match.one, match.two)) {
                    if (match.outcome === "one") oneSameLineWins++;
                    if (match.outcome === "two") twoSameLineWins++;
                }
            });

            const completedTimeMatches = matches
                .filter(match => match.one.timeSeconds != null && match.two.timeSeconds != null)
                .map(match => ({
                    ...match,
                    difference: Math.abs(Number(match.one.timeSeconds) - Number(match.two.timeSeconds))
                }))
                .filter(match => Number.isFinite(match.difference));

            const closestMatch = completedTimeMatches.length
                ? completedTimeMatches.reduce((closest, current) => current.difference < closest.difference ? current : closest)
                : null;
            const mostRecentMatch = matches.length ? matches[0] : null;

            status.textContent = `${number(matches.length)} shared races · ${normalOnlyCheckbox.checked ? "Normal races only" : "All race types"}`;

            const summary = makeElement("div", "stats-grid h2h-summary-grid");
            appendSummaryCard(summary, `${playerOne} Wins`, number(oneWins), `${number(oneSameLineWins)} wins when both picked the same 5-square line`);
            appendSummaryCard(summary, `${playerTwo} Wins`, number(twoWins), `${number(twoSameLineWins)} wins when both picked the same 5-square line`);
            appendSummaryCard(summary, "Ties", number(ties), "Includes races where both players forfeited");
            appendSummaryCard(summary, "Shared Races", number(matches.length), "Races in which both players participated");
            resultsContainer.appendChild(summary);

            const highlights = makeElement("div", "h2h-highlights");
            highlights.append(
                buildHighlight("Most Recent Match", mostRecentMatch, playerOne, playerTwo, "recent"),
                buildHighlight("Closest Match", closestMatch, playerOne, playerTwo, "closest")
            );
            resultsContainer.appendChild(highlights);
            resultsContainer.appendChild(renderTable(matches, playerOne, playerTwo));
        }

        normalOnlyCheckbox.addEventListener("change", renderComparison);
    } catch (error) {
        status.textContent = "Unable to load head-to-head race data.";
        resultsContainer.replaceChildren(makeElement("p", "h2h-error", error.message));
        console.error(error);
    }
}

loadHeadToHead();
