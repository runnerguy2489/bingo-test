
async function loadMonthlyStats() {
    const container = document.getElementById("monthly-stats");

    try {
        const response = await fetch("monthly_race_counts.json");

        if (!response.ok) {
            throw new Error("Could not load race data.");
        }

        const data = await response.json();

        // Display each year, starting with the most recent.
        const years = Object.keys(data.years).sort((a, b) => b - a);

        years.forEach(year => {
            const months = data.years[year];

            // Find the busiest month for scaling the bars.
            const maxCount = Math.max(...months.map(month => month.count));

            const yearSection = document.createElement("section");
            yearSection.className = "year-section";

            yearSection.innerHTML = `
                <h2>${year}</h2>
                <div class="monthly-chart">
                    ${months.map(month => {
                        const barWidth = maxCount > 0
                            ? (month.count / maxCount) * 100
                            : 0;

                        return `
                            <div class="month-row">
                                <span class="month-name">${month.month}</span>
                                <div class="bar-container">
                                    <div class="bar" style="width: ${barWidth}%"></div>
                                </div>
                                <span class="race-count">${month.count}</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;

            container.appendChild(yearSection);
        });

    } catch (error) {
        container.textContent = "Unable to load monthly race statistics.";
        console.error(error);
    }
}

loadMonthlyStats();
