
async function loadMonthlyStats() {
    const container = document.getElementById("monthly-stats");

    try {
        const response = await fetch("monthly_race_counts.json");

        if (!response.ok) {
            throw new Error("Could not load race data.");
        }

        const data = await response.json();

        const years = Object.keys(data.years).sort((a, b) => b - a);

        // Create the year selection buttons.
        const yearButtons = document.createElement("div");
        yearButtons.className = "year-buttons";

        // Container for the selected year's chart.
        const chartContainer = document.createElement("div");
        chartContainer.id = "year-chart";

        container.appendChild(yearButtons);
        container.appendChild(chartContainer);

        function displayYear(year) {
            const months = data.years[year];

            const maxCount = Math.max(...months.map(month => month.count));

            const total = months.reduce((sum, month) => sum + month.count, 0);

            // Update the selected button.
            yearButtons.querySelectorAll("button").forEach(button => {
                button.classList.toggle("active", button.dataset.year === year);
            });

            // Build the monthly chart.
            chartContainer.innerHTML = `
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
                <div class="year-total">
                    <span>Total races</span>
                    <strong>${total.toLocaleString()}</strong>
                </div>
            `;
        }

        // Create one button for each year.
        years.forEach(year => {
            const button = document.createElement("button");

            button.textContent = year;
            button.dataset.year = year;
            button.addEventListener("click", () => displayYear(year));

            yearButtons.appendChild(button);
        });

        // Show the most recent year initially.
        displayYear(years[0]);

    } catch (error) {
        container.textContent = "Unable to load monthly race statistics.";
        console.error(error);
    }
}

loadMonthlyStats();
