
import json
import math
import argparse
from pathlib import Path


def is_valid_time(value):
    """Return True when timeSeconds is a valid numeric value."""
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def generate_player_race_data(input_path, output_path):
    input_path = Path(input_path)
    output_path = Path(output_path)

    print(f"Reading source file: {input_path}")

    if not input_path.exists():
        raise FileNotFoundError(
            f"Could not find input file: {input_path}"
        )

    with input_path.open("r", encoding="utf-8") as file:
        source_data = json.load(file)

    if not isinstance(source_data, dict) or not isinstance(
        source_data.get("races"), list
    ):
        raise ValueError(
            "Input file does not have the expected converted JSON structure."
        )

    source_races = source_data["races"]

    compact_races = []
    player_result_count = 0
    valid_timed_result_count = 0

    all_types = set()
    all_versions = set()

    print(f"Processing {len(source_races):,} races...")

    for race in source_races:
        race_type = str(race.get("type") or "")
        version = str(race.get("version") or "")

        all_types.add(race_type)
        all_versions.add(version)

        compact_players = []

        for player in race.get("players") or []:
            time_seconds = player.get("timeSeconds")

            if not is_valid_time(time_seconds):
                time_seconds = None
            else:
                valid_timed_result_count += 1

            compact_player = {
                "username": player.get("username"),
                "rank": player.get("rank"),
                "timeSeconds": time_seconds,
                "rowCol": player.get("rowCol")
            }

            compact_players.append(compact_player)
            player_result_count += 1

        compact_race = {
            "raceId": race.get("raceId"),
            "version": version,
            "type": race_type,
            "players": compact_players
        }

        compact_races.append(compact_race)

    # Build the output dataset.
    output_data = {
        "schemaVersion": 1,
        "sourceFile": input_path.name,
        "raceCount": len(compact_races),
        "playerResultCount": player_result_count,
        "validTimedResultCount": valid_timed_result_count,
        "types": sorted(all_types),
        "versions": sorted(all_versions),
        "races": compact_races
    }

    print(f"Writing output file: {output_path}")

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(
            output_data,
            file,
            ensure_ascii=False,
            indent=2
        )

    output_size_mb = output_path.stat().st_size / (1024 * 1024)

    # Report results.
    print()
    print("========== GENERATION COMPLETE ==========")
    print(f"Races processed:       {len(compact_races):,}")
    print(f"Player results:        {player_result_count:,}")
    print(f"Valid timed results:   {valid_timed_result_count:,}")
    print(f"Unique race types:     {len(all_types)}")
    print(f"Unique versions:       {len(all_versions)}")
    print(f"Output file size:      {output_size_mb:.2f} MB")
    print(f"Output file:           {output_path}")

    # Check whether the original metadata matches the actual records.
    metadata_count = source_data.get("raceCount")

    if metadata_count is not None and metadata_count != len(source_races):
        print()
        print(
            "WARNING: Source metadata raceCount "
            f"({metadata_count:,}) does not match the "
            f"actual number of races ({len(source_races):,})."
        )
        print("The output uses the actual number of race records.")

    print("=========================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate compact race data for player statistics."
    )

    parser.add_argument(
        "--input",
        default="bingo_races_fixed_urls.json",
        help="Input converted race JSON file."
    )

    parser.add_argument(
        "--output",
        default="player_race_data.json",
        help="Output compact player race JSON file."
    )

    args = parser.parse_args()

    generate_player_race_data(args.input, args.output)
