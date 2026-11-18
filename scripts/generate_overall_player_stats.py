
#!/usr/bin/env python3

"""
Generate overall player statistics from bingo_races_fixed_urls.json.

Usage:
    python generate_overall_player_stats.py

Optional:
    python generate_overall_player_stats.py input.json output.json

Statistics:
    Bingos Entered = Every race entry for that player
    Completions = Entries with a valid timeSeconds value
    Forfeits = Entries without a valid timeSeconds value
    % Complete = Completions / Bingos Entered
    Wins = Completed entries with rank 1
    Win % = Wins / Bingos Entered
    Top 3 Finishes = Completed entries with rank 1, 2, or 3
    Total Time = Sum of completed timeSeconds values
"""

import json
import sys
from collections import defaultdict
from pathlib import Path


DEFAULT_INPUT = "bingo_races_filtered.json"
DEFAULT_OUTPUT = "overall_player_stats.json"


def is_completed(result):
    """Check whether a player has a valid completion time."""
    seconds = result.get("timeSeconds")

    return (
        isinstance(seconds, (int, float))
        and not isinstance(seconds, bool)
        and seconds >= 0
    )


def build_player_stats(source):
    races = source.get("races")

    if not isinstance(races, list):
        raise ValueError('Input JSON must contain a "races" list.')

    stats = defaultdict(lambda: {
        "player": "",
        "bingosEntered": 0,
        "completions": 0,
        "forfeits": 0,
        "wins": 0,
        "top3Finishes": 0,
        "totalTimeSeconds": 0
    })

    processed_results = 0

    # Process every race and every player result.
    for race in races:
        for result in race.get("players", []):

            username = result.get("username")

            if not isinstance(username, str) or not username.strip():
                continue

            player = stats[username]

            player["player"] = username
            player["bingosEntered"] += 1
            processed_results += 1

            if is_completed(result):
                player["completions"] += 1
                player["totalTimeSeconds"] += result["timeSeconds"]

                rank = result.get("rank")

                # Only completed results count toward wins and top 3.
                if isinstance(rank, int):
                    if rank == 1:
                        player["wins"] += 1

                    if 1 <= rank <= 3:
                        player["top3Finishes"] += 1

            else:
                player["forfeits"] += 1

    # Calculate percentages and prepare output.
    output_players = []

    for player in stats.values():
        entered = player["bingosEntered"]

        player["completionPercent"] = round(
            player["completions"] / entered * 100,
            2
        )

        player["winPercent"] = round(
            player["wins"] / entered * 100,
            2
        )

        output_players.append(player)

    # Alphabetical default order.
    output_players.sort(
        key=lambda item: item["player"].casefold()
    )

    return {
        "schemaVersion": 1,
        "source": DEFAULT_INPUT,
        "raceCount": len(races),
        "playerResultCount": processed_results,
        "playerCount": len(output_players),
        "players": output_players
    }


def main():

    # Allow optional input/output filenames.
    input_path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(DEFAULT_INPUT)
    )

    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else Path(DEFAULT_OUTPUT)
    )

    if not input_path.exists():
        raise FileNotFoundError(
            f"Could not find {input_path}. "
            "Place the input JSON in the same folder as this script "
            "or provide its path as an argument."
        )

    print(f"Reading: {input_path}")

    with input_path.open("r", encoding="utf-8") as file:
        source = json.load(file)

    output = build_player_stats(source)
    output["source"] = input_path.name

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2
        )

    print()
    print("========== OVERALL PLAYER STATS COMPLETE ==========")
    print(f"Races processed:       {output['raceCount']:,}")
    print(f"Player results:        {output['playerResultCount']:,}")
    print(f"Unique players:        {output['playerCount']:,}")
    print(f"Output file:           {output_path.resolve()}")
    print("===================================================")


if __name__ == "__main__":
    main()
