async function loadOverallStats() {
    const container = document.getElementById("overall-stats");

    try {
        const response = await fetch("overall_stats.json");
        if (!response.ok) throw new Error("Could not load overall statistics.");

        const data = await response.json();
        const number = value => Number(value).toLocaleString();
        const percent = value => `${(value * 100).toFixed(2)}%`;

        const largestRace = data.mostEntrantsRace;
        let largestRaceDetail = "";

        if (largestRace) {
            const date = largestRace.date
                ? new Date(`${largestRace.date}Z`).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC"
                })
                : "";

            largestRaceDetail = [
                largestRace.type,
                date,
                largestRace.raceId ? `Race #${largestRace.raceId}` : ""
            ].filter(Boolean).join(" · ");
        }

        const summary = document.createElement("div");
        summary.className = "stats-grid";

        const cards = [
            { label: "Bingo Races", value: number(data.totalRaces) },
            { label: "Player Entries", value: number(data.totalPlayerResults) },
            { label: "Unique Players", value: number(data.uniquePlayers) },
            { label: "Average Entrants per Race", value: Number(data.averageEntrantsPerRace).toFixed(2) },
            {
                label: "Most Entrants in a Race",
                value: number(data.mostEntrantsInRace),
                detail: largestRaceDetail,
                url: largestRace?.raceUrl
            },
            { label: "Completion Rate", value: percent(data.completionRate) },
            { label: "Completions", value: number(data.completions) },
            { label: "Forfeits", value: number(data.forfeits) },
            { label: "Average Normal Finish", value: data.averageNormalFinishTime || "N/A", detail: `${number(data.normalFinishCount)} successful finishes` },
            { label: "Average Normal Winning Time", value: data.averageNormalWinnerTime || "N/A", detail: `${number(data.normalWinnerCount)} winning times` }
        ];

        cards.forEach(cardData => {
            const card = document.createElement(cardData.url ? "a" : "section");
            card.className = "stat-card";
            if (cardData.url) {
                card.classList.add("stat-card-link");
                card.href = cardData.url;
                card.target = "_blank";
                card.rel = "noopener noreferrer";
                card.setAttribute("aria-label", `${cardData.label}: ${cardData.value}. Open race results in a new tab.`);
            }

            const label = document.createElement("div");
            label.className = "stat-label";
            label.textContent = cardData.label;

            const value = document.createElement("div");
            value.className = "stat-value";
            value.textContent = cardData.value;
            card.append(label, value);

            if (cardData.detail) {
                const detail = document.createElement("div");
                detail.className = "stat-detail";
                detail.textContent = cardData.detail;
                card.appendChild(detail);
            }
            summary.appendChild(card);
        });

        const note = document.createElement("p");
        note.className = "stats-note";
        note.textContent =
            "A completion is a player result with a recorded finish time; a forfeit has no recorded finish time. " +
            "Average Normal Finish is calculated from all timed player results in normal races. " +
            "Average Normal Winning Time is calculated from recorded first-place times in normal races.";

        const typeSection = document.createElement("section");
        typeSection.className = "race-type-section";
        const heading = document.createElement("h3");
        heading.textContent = "Races by Type";
        typeSection.appendChild(heading);

        const typeList = document.createElement("div");
        typeList.className = "race-type-list";

        data.raceTypes.forEach(item => {
            const row = document.createElement("div");
            row.className = "race-type-row";

            const name = document.createElement("span");
            name.className = "race-type-name";
            name.textContent = item.type;

            const count = document.createElement("span");
            count.className = "race-type-count";
            count.textContent = number(item.count);

            row.append(name, count);
            typeList.appendChild(row);
        });

        typeSection.appendChild(typeList);
        container.replaceChildren(summary, note, typeSection);
    } catch (error) {
        container.textContent = "Unable to load overall statistics.";
        console.error(error);
    }
}

loadOverallStats();
