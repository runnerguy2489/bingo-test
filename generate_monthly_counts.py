import json
import calendar
from collections import Counter
from datetime import datetime
from pathlib import Path

# Keep this script in the same folder as bingo_races_fixed.json.
folder = Path(__file__).resolve().parent
input_file = folder / "bingo_races_fixed.json"
output_file = folder / "monthly_race_counts.json"

# Load the full race dataset.
with input_file.open("r", encoding="utf-8") as file:
    data = json.load(file)

# Count races by year and month using each race's date.
monthly_counts = Counter()

for race in data["races"]:
    race_date = datetime.fromisoformat(race["date"])
    monthly_counts[(race_date.year, race_date.month)] += 1

# Include all 12 months for every year, even if a month had zero races.
years = sorted({year for year, month in monthly_counts}, reverse=True)

summary = {
    "totalRaces": len(data["races"]),
    "source": input_file.name,
    "years": {
        str(year): [
            {
                "month": calendar.month_name[month],
                "count": monthly_counts[(year, month)]
            }
            for month in range(1, 13)
        ]
        for year in years
    }
}

# Save the small summary file that the website will use.
with output_file.open("w", encoding="utf-8") as file:
    json.dump(summary, file, indent=2)

print(f"Races counted: {len(data['races'])}")
print(f"Years included: {years[0]} through {years[-1]}")
print(f"Summary saved to: {output_file}")
