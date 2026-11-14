#!/usr/bin/env python3
"""
Generate the compact race dataset used by player_profile.html.

Usage:
    python generate_player_profile_stats.py
    python generate_player_profile_stats.py input.json output.json

The generated file retains race date/type/version, player results, and selected
goal names so the browser can calculate filtered career stats, recent times,
time distribution, and item-choice counts.
"""
import json
import math
import sys
from pathlib import Path

DEFAULT_INPUT = "bingo_races_filtered.json"
DEFAULT_OUTPUT = "player_profile_stats.json"


def valid_time(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def build_profile_data(source, source_name):
    races = source.get("races")
    if not isinstance(races, list):
        raise ValueError('Input JSON must contain a "races" list.')

    compact_races = []
    player_result_count = 0

    for race in races:
        goals = race.get("goals") or []
        players = []

        for result in race.get("players") or []:
            indexes = result.get("selectionIndexes") or []
            selected_items = [
                goals[index]
                for index in indexes
                if isinstance(index, int) and 0 <= index < len(goals)
            ]
            seconds = result.get("timeSeconds")
            if not valid_time(seconds):
                seconds = None

            players.append({
                "username": result.get("username"),
                "rank": result.get("rank"),
                "time": result.get("time"),
                "timeSeconds": seconds,
                "rowCol": result.get("rowCol"),
                "selectedItems": selected_items
            })
            player_result_count += 1

        compact_races.append({
            "raceId": race.get("raceId"),
            "date": race.get("date"),
            "version": str(race.get("version") or ""),
            "type": str(race.get("type") or ""),
            "raceUrl": race.get("raceUrl"),
            "players": players
        })

    return {
        "schemaVersion": 1,
        "sourceFile": source_name,
        "raceCount": len(compact_races),
        "playerResultCount": player_result_count,
        "races": compact_races
    }


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_INPUT)
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(DEFAULT_OUTPUT)

    if not input_path.exists():
        raise FileNotFoundError(f"Could not find input file: {input_path}")

    with input_path.open("r", encoding="utf-8") as file:
        source = json.load(file)

    output = build_profile_data(source, input_path.name)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, separators=(",", ":"))

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print("========== PLAYER PROFILE DATA COMPLETE ==========")
    print(f"Races processed: {output['raceCount']:,}")
    print(f"Player results:  {output['playerResultCount']:,}")
    print(f"Output size:     {size_mb:.2f} MB")
    print(f"Output file:     {output_path.resolve()}")
    print("===================================================")


if __name__ == "__main__":
    main()
