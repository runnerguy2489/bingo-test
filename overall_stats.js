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
            parts.push(`${amount}${label}`);
            remaining %= seconds;
        }
    });

    return parts.join(" ") || "0s";
}


// Compare numeric version components (e.g. 9.2 before 9.10).
function compareNumericVersions(a, b) {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    const length = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < length; i++) {
        const valueA = partsA[i] || 0;
        const valueB = partsB[i] || 0;

        if (valueA !== valueB) {
            return valueA - valueB;
        }
    }

    return 0;
}


// Sort regular versions, then beta versions, then c1, then Unknown.
function compareVersionLabels(a, b) {
    function getVersionInfo(version) {
        if (version.toLowerCase() === "c1") {
            return { category: 2, numbers: [] };
        }

        if (version.toLowerCase() === "unknown") {
            return { category: 3, numbers: [] };
        }

        if (version.toLowerCase().startsWith("beta")) {
            return {
                category: 1,
                numbers: version.substring(4).match(/\d+/g)?.map(Number) || []
            };
        }

        return {
            category: 0,
            numbers: version.match(/\d+/g)?.map(Number) || []
        };
    }

    const versionA = getVersionInfo(a);
    const versionB = getVersionInfo(b);

    if (versionA.category !== versionB.category) {
        return versionA.category - versionB.category;
    }

    if (versionA.category === 0 || versionA.category === 1) {
        return compareNumericVersions(
            versionA.numbers.join("."),
            versionB.numbers.join(".")
        );
    }

    return a.localeCompare(b);
}


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
            { label: "Total Time", value: formatTotalDuration(data.totalTimeSeconds) },
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
            {
                label: "Average Normal Finish",
                value: data.averageNormalFinishTime || "N/A",
                detail: `${number(data.normalFinishCount)} successful finishes`
            },
            {
                label: "Average Normal Winning Time",
                value: data.averageNormalWinnerTime || "N/A",
                detail: `${number(data.normalWinnerCount)} winning times`
            },
            {
                label: "Normal Bingo Blanks",
                value: number(data.normalBingoBlanks),
                detail: "Timed results without a row/column"
            },
            {
                label: "Normal Bingo Blanks (V7+)",
                value: number(data.normalBingoBlanksV7Plus),
                detail: "Includes V7+ beta versions"
            }
        ];

        cards.forEach(cardData => {
            const card = document.createElement(cardData.url ? "a" : "section");
            card.className = "stat-card";

            if (cardData.url) {
                card.classList.add("stat-card-link");
                card.href = cardData.url;
                card.target = "_blank";
                card.rel = "noopener noreferrer";
                card.setAttribute(
                    "aria-label",
                    `${cardData.label}: ${cardData.value}. Open race results in a new tab.`
                );
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
            "Average Normal Winning Time is calculated from recorded first-place times in normal races. " +
            "Normal Bingo Blanks count timed player results in normal races without an associated row/column. " +
            "The V7+ blank count includes beta versions of V7 and later.";

        // Create the two breakdown buttons.
        const tabs = document.createElement("div");
        tabs.className = "breakdown-tabs";

        const typeButton = document.createElement("button");
        typeButton.textContent = "Races by Type";
        typeButton.className = "active";
        typeButton.setAttribute("aria-pressed", "true");

        const versionButton = document.createElement("button");
        versionButton.textContent = "Races by Version";
        versionButton.setAttribute("aria-pressed", "false");

        tabs.append(typeButton, versionButton);

        // Create the area where the selected breakdown is displayed.
        const breakdownContent = document.createElement("div");
        breakdownContent.className = "breakdown-content";

        function createBreakdownList(items, nameProperty) {
            const section = document.createElement("section");
            section.className = "race-type-section";

            const list = document.createElement("div");
            list.className = "race-type-list";

            (items || []).forEach(item => {
                const row = document.createElement("div");
                row.className = "race-type-row";

                const name = document.createElement("span");
                name.className = "race-type-name";
                name.textContent = item[nameProperty];

                const count = document.createElement("span");
                count.className = "race-type-count";
                count.textContent = number(item.count);

                row.append(name, count);
                list.appendChild(row);
            });

            section.appendChild(list);
            return section;
        }

        // Type order is already sorted by count in the JSON.
        const typeItems = data.raceTypes || [];

        // Version order is sorted numerically here, not by count.
        const versionItems = [...(data.raceVersions || [])].sort(
            (a, b) => compareVersionLabels(a.version, b.version)
        );

        function showBreakdown(type) {
            const isType = type === "type";

            typeButton.classList.toggle("active", isType);
            versionButton.classList.toggle("active", !isType);

            typeButton.setAttribute("aria-pressed", String(isType));
            versionButton.setAttribute("aria-pressed", String(!isType));

            const section = isType
                ? createBreakdownList(typeItems, "type")
                : createBreakdownList(versionItems, "version");

            breakdownContent.replaceChildren(section);
        }

        typeButton.addEventListener("click", () => showBreakdown("type"));
        versionButton.addEventListener("click", () => showBreakdown("version"));

        // Default to Races by Type.
        showBreakdown("type");

        container.replaceChildren(
            summary,
            note,
            tabs,
            breakdownContent
        );

    } catch (error) {
        container.textContent = "Unable to load overall statistics.";
        console.error(error);
    }
}

loadOverallStats();
