
import json
import math
import sys
from collections import defaultdict
from pathlib import Path


# ============================================================
# SETTINGS
# ============================================================

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
INPUT_FILE = str(DATA_DIR / "bingo_races_filtered.json")
OUTPUT_FILE = str(DATA_DIR / "overall_item_stats.json")

# Target time in seconds.
# 75 * 60 = 1 hour, 15 minutes, 0 seconds.
# Change this value to adjust the target in the future.
UNDER_TARGET_SECONDS = 75 * 60


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def is_completed(player):
    """
    A player result is considered completed if it has a valid,
    finite, non-negative numeric timeSeconds value.
    """
    time_seconds = player.get("timeSeconds")

    if isinstance(time_seconds, bool):
        return False

    if not isinstance(time_seconds, (int, float)):
        return False

    return math.isfinite(time_seconds) and time_seconds >= 0


def get_rank(player):
    """
    Convert rank to an integer when possible.
    """
    rank = player.get("rank")

    if isinstance(rank, bool):
        return None

    if isinstance(rank, int):
        return rank

    if isinstance(rank, str):
        try:
            return int(rank)
        except ValueError:
            return None

    if isinstance(rank, float) and math.isfinite(rank):
        if rank.is_integer():
            return int(rank)

    return None


def get_selected_items(player, goals):
    """
    Convert selectionIndexes into unique item names.

    Duplicate selections of the same item by one player
    are counted only once.
    """
    selection_indexes = player.get("selectionIndexes") or []

    selected_items = set()

    for index in selection_indexes:
        if isinstance(index, bool) or not isinstance(index, int):
            continue

        if 0 <= index < len(goals):
            item = goals[index]

            if isinstance(item, str) and item.strip():
                selected_items.add(item.strip())

    return selected_items


# ============================================================
# MAIN AGGREGATION
# ============================================================

def build_item_stats(data):

    # Statistics grouped by bingo type and version.
    groups = defaultdict(dict)

    race_counts = defaultdict(int)
    board_counts = defaultdict(int)

    completed_player_result_count = 0

    races = data.get("races", [])

    for race in races:

        bingo_type = race.get("type")
        version = race.get("version")

        if not bingo_type or version is None:
            continue

        group_key = (bingo_type, str(version))

        race_counts[group_key] += 1

        goals = race.get("goals") or []

        # A race without a usable board cannot contribute
        # item appearances or item selections.
        if not goals:
            continue

        board_counts[group_key] += 1

        # Make sure every distinct board item is counted once
        # for appearances, even if it appears multiple times.
        board_items = {
            goal.strip()
            for goal in goals
            if isinstance(goal, str) and goal.strip()
        }

        for item in board_items:

            if item not in groups[group_key]:

                groups[group_key][item] = {
                    "item": item,
                    "appearances": 0,
                    "used": 0,
                    "wins": 0,
                    "top3Finishes": 0,
                    "totalTimeSeconds": 0,
                    "times": [],
                    "underTarget": 0
                }

            groups[group_key][item]["appearances"] += 1

        # Process player results.
        for player in race.get("players", []):

            if not is_completed(player):
                continue

            completed_player_result_count += 1

            time_seconds = player["timeSeconds"]
            rank = get_rank(player)

            selected_items = get_selected_items(player, goals)

            for item in selected_items:

                # Ignore selected items that were not included
                # in the board's distinct item list.
                if item not in groups[group_key]:
                    continue

                stats = groups[group_key][item]

                stats["used"] += 1

                if rank == 1:
                    stats["wins"] += 1

                if rank is not None and rank <= 3 and rank >= 1:
                    stats["top3Finishes"] += 1

                stats["totalTimeSeconds"] += time_seconds
                stats["times"].append(time_seconds)

                # The target applies only to normal bingo.
                # The comparison is strictly less than the target.
                if (
                    bingo_type == "normal"
                    and time_seconds < UNDER_TARGET_SECONDS
                ):
                    stats["underTarget"] += 1

    # ========================================================
    # FORMAT OUTPUT
    # ========================================================

    output_groups = []

    for (bingo_type, version), item_stats in sorted(
        groups.items(),
        key=lambda x: (x[0][0], x[0][1])
    ):

        items = []

        for item, stats in item_stats.items():

            times = sorted(stats["times"])

            items.append({
                "item": item,
                "appearances": stats["appearances"],
                "used": stats["used"],
                "wins": stats["wins"],
                "top3Finishes": stats["top3Finishes"],
                "totalTimeSeconds": stats["totalTimeSeconds"],
                "times": times,
                "underTarget": stats["underTarget"]
            })

        items.sort(key=lambda x: x["item"].lower())

        output_groups.append({
            "type": bingo_type,
            "version": version,
            "raceCount": race_counts[(bingo_type, version)],
            "boardCount": board_counts[(bingo_type, version)],
            "items": items
        })

    output = {
        "underTargetSeconds": UNDER_TARGET_SECONDS,
        "raceTypes": sorted({
            group["type"] for group in output_groups
        }),
        "versions": sorted({
            group["version"] for group in output_groups
        }),
        "raceCounts": {
            f"{bingo_type}_{version}": count
            for (bingo_type, version), count in race_counts.items()
        },
        "boardCounts": {
            f"{bingo_type}_{version}": count
            for (bingo_type, version), count in board_counts.items()
        },
        "raceCount": len(races),
        "completedPlayerResultCount": completed_player_result_count,
        "groups": output_groups
    }

    return output


# ============================================================
# RUN SCRIPT
# ============================================================

def main():

    input_path = Path(INPUT_FILE)
    output_path = Path(OUTPUT_FILE)

    if not input_path.exists():
        print(f"ERROR: Could not find input file: {INPUT_FILE}")
        sys.exit(1)

    print(f"Reading {INPUT_FILE}...")

    with input_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    print(f"Found {len(data.get('races', []))} races.")

    output = build_item_stats(data)

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(output, file, indent=2, ensure_ascii=False)

    total_items = sum(
        len(group["items"])
        for group in output["groups"]
    )

    print()
    print("========== CONVERSION COMPLETE ==========")
    print(f"Races processed: {output['raceCount']}")
    print(
        "Completed player results: "
        f"{output['completedPlayerResultCount']}"
    )
    print(f"Groups created: {len(output['groups'])}")
    print(f"Item entries created: {total_items}")
    print(
        "Under-target cutoff: "
        f"{UNDER_TARGET_SECONDS} seconds"
    )
    print(f"Output saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
