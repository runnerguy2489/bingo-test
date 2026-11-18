#!/usr/bin/env python3

"""Generate overall item statistics from bingo_races_filtered.json.

Usage:
    python generate_overall_item_stats.py
    python generate_overall_item_stats.py input.json output.json

Only completed player results (valid timeSeconds) contribute to Used, wins,
top-three finishes, and time statistics. Board appearances are counted once
per item per race board. Under 1:15:00 is limited to normal bingo races.
"""

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_INPUT = "bingo_races_filtered.json"
DEFAULT_OUTPUT = "overall_item_stats.json"


def is_completed(result):
    seconds = result.get("timeSeconds")
    return (
        isinstance(seconds, (int, float))
        and not isinstance(seconds, bool)
        and math.isfinite(seconds)
        and seconds >= 0
    )


def build_item_stats(source):
    races = source.get("races")
    if not isinstance(races, list):
        raise ValueError('Input JSON must contain a "races" list.')

    stats = {}
    race_counts = defaultdict(lambda: defaultdict(int))
    board_counts = defaultdict(lambda: defaultdict(int))
    completed_results = 0
    selected_item_uses = 0

    def get_entry(race_type, version, item):
        return stats.setdefault(race_type, {}).setdefault(version, {}).setdefault(item, {
            "appearances": 0,
            "used": 0,
            "wins": 0,
            "top3Finishes": 0,
            "totalTimeSeconds": 0,
            "times": [],
            "under75Minutes": 0,
        })

    for race in races:
        race_type = str(race.get("type", ""))
        version = str(race.get("version", ""))
        race_counts[race_type][version] += 1

        goals = race.get("goals")
        if not isinstance(goals, list) or not goals:
            continue

        board_counts[race_type][version] += 1
        board_items = {
            goal.strip()
            for goal in goals
            if isinstance(goal, str) and goal.strip()
        }
        for item in board_items:
            get_entry(race_type, version, item)["appearances"] += 1

        for result in race.get("players", []) or []:
            if not isinstance(result, dict) or not is_completed(result):
                continue
            username = result.get("username")
            if not isinstance(username, str) or not username.strip():
                continue

            completed_results += 1
            indexes = result.get("selectionIndexes")
            if not isinstance(indexes, list):
                continue

            selected_items = set()
            for index in indexes:
                if (
                    isinstance(index, int)
                    and not isinstance(index, bool)
                    and 0 <= index < len(goals)
                ):
                    item = goals[index]
                    if isinstance(item, str) and item.strip():
                        selected_items.add(item.strip())

            try:
                rank = int(result.get("rank"))
            except (TypeError, ValueError):
                rank = None

            seconds = result["timeSeconds"]
            for item in selected_items:
                entry = get_entry(race_type, version, item)
                entry["used"] += 1
                selected_item_uses += 1
                if rank == 1:
                    entry["wins"] += 1
                if rank is not None and 1 <= rank <= 3:
                    entry["top3Finishes"] += 1
                entry["totalTimeSeconds"] += seconds
                entry["times"].append(seconds)
                if race_type == "normal" and seconds < 4500:
                    entry["under75Minutes"] += 1

    groups = {}
    all_versions = set()
    for race_type, versions in stats.items():
        groups[race_type] = {}
        for version, items in versions.items():
            all_versions.add(version)
            rows = []
            for item, data in items.items():
                rows.append({
                    "item": item,
                    "appearances": data["appearances"],
                    "used": data["used"],
                    "wins": data["wins"],
                    "top3Finishes": data["top3Finishes"],
                    "totalTimeSeconds": round(data["totalTimeSeconds"], 3),
                    "times": sorted(data["times"]),
                    "under75Minutes": data["under75Minutes"],
                })
            rows.sort(key=lambda row: row["item"].casefold())
            groups[race_type][version] = rows

    return {
        "schemaVersion": 1,
        "source": DEFAULT_INPUT,
        "raceCount": len(races),
        "completedPlayerResultCount": completed_results,
        "selectedItemUseCount": selected_item_uses,
        "raceTypes": sorted(groups.keys()),
        "versions": sorted(all_versions, key=lambda value: value.casefold()),
        "raceCounts": {key: dict(value) for key, value in race_counts.items()},
        "boardCounts": {key: dict(value) for key, value in board_counts.items()},
        "groups": groups,
    }


def main():
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_INPUT)
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(DEFAULT_OUTPUT)

    if not input_path.exists():
        raise FileNotFoundError(
            "Could not find {}. Place the input JSON beside this script "
            "or provide its path as an argument.".format(input_path)
        )

    print("Reading: {}".format(input_path))
    with input_path.open("r", encoding="utf-8") as file:
        source = json.load(file)

    output = build_item_stats(source)
    output["source"] = input_path.name
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, separators=(",", ":"))

    item_rows = sum(
        len(rows)
        for versions in output["groups"].values()
        for rows in versions.values()
    )
    print("\n========== OVERALL ITEM STATS COMPLETE ==========")
    print("Races processed:          {:,}".format(output["raceCount"]))
    print("Completed player results: {:,}".format(output["completedPlayerResultCount"]))
    print("Selected item uses:       {:,}".format(output["selectedItemUseCount"]))
    print("Item/version rows:        {:,}".format(item_rows))
    print("Output file:              {}".format(output_path.resolve()))
    print("=================================================")


if __name__ == "__main__":
    main()
