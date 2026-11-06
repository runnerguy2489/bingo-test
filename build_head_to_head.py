
import json
import os
import argparse


def build_head_to_head(input_file, output_file):
    print(f"Reading source file: {input_file}")

    with open(input_file, "r", encoding="utf-8") as f:
        source_data = json.load(f)

    source_races = source_data.get("races", [])

    compact_races = []
    unique_players = set()
    player_result_count = 0
    skipped_races = 0

    print(f"Checking {len(source_races):,} races...")

    for race in source_races:

        # Only include normal bingo races
        if race.get("type") != "normal":
            skipped_races += 1
            continue

        compact_players = []

        for player in race.get("players", []):

            username = player.get("username")

            if username is None or not str(username).strip():
                continue

            username = str(username)

            unique_players.add(username)
            player_result_count += 1

            compact_players.append({
                "username": username,
                "rank": player.get("rank"),
                "time": player.get("time"),
                "timeSeconds": player.get("timeSeconds"),
                "rowCol": player.get("rowCol")
            })

        compact_races.append({
            "raceId": race.get("raceId"),
            "date": race.get("date"),
            "version": race.get("version"),
            "raceUrl": race.get("raceUrl"),
            "players": compact_players
        })

    # Sort players alphabetically, ignoring case
    player_list = sorted(unique_players, key=str.casefold)

    # Build final output
    output_data = {
        "schemaVersion": 1,
        "source": os.path.basename(input_file),
        "raceType": "normal",
        "raceCount": len(compact_races),
        "playerResultCount": player_result_count,
        "uniquePlayerCount": len(player_list),
        "players": player_list,
        "races": compact_races
    }

    print(f"Writing output file: {output_file}")

    # Compact JSON keeps the download size smaller
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(
            output_data,
            f,
            ensure_ascii=False,
            separators=(",", ":")
        )

    output_size = os.path.getsize(output_file) / (1024 * 1024)

    print("\n========== CONVERSION COMPLETE ==========")
    print(f"Source races:          {len(source_races):,}")
    print(f"Skipped non-normal:    {skipped_races:,}")
    print(f"Normal races:          {len(compact_races):,}")
    print(f"Player results:        {player_result_count:,}")
    print(f"Unique players:        {len(player_list):,}")
    print(f"Output file size:      {output_size:.2f} MB")
    print(f"Output file:           {output_file}")


if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="Build compact normal-bingo head-to-head race data."
    )

    parser.add_argument(
        "--input",
        default="bingo_races_fixed_urls.json",
        help="Source JSON file"
    )

    parser.add_argument(
        "--output",
        default="head_to_head.json",
        help="Output JSON file"
    )

    args = parser.parse_args()

    build_head_to_head(args.input, args.output)
