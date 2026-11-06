#!/usr/bin/env python3
"""Generate the lightweight overall_stats.json used by the OoT Bingo Stats site.

Usage:
    python generate_overall_stats.py
    python generate_overall_stats.py --input bingo_races_fixed.json --output overall_stats.json

The full source race JSON is not needed by website visitors.
"""
import argparse
import json
from collections import Counter
from pathlib import Path


def format_duration(seconds):
    total_seconds = int(round(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}"


def generate_stats(source_path):
    with source_path.open("r", encoding="utf-8") as file:
        source_data = json.load(file)

    races = source_data.get("races")
    if not isinstance(races, list):
        raise ValueError("Input JSON must contain a 'races' list.")

    race_type_counts = Counter()
    player_result_count = 0
    completion_count = 0
    forfeit_count = 0
    entrant_total = 0
    normal_finish_times = []
    normal_winner_times = []

    for race in races:
        race_type = race.get("type") or "Unknown"
        race_type_counts[race_type] += 1
        players = race.get("players") or []
        entrant_total += len(players)
        player_result_count += len(players)

        for player in players:
            time_seconds = player.get("timeSeconds")
            if isinstance(time_seconds, (int, float)) and not isinstance(time_seconds, bool):
                completion_count += 1
                if race_type == "normal":
                    normal_finish_times.append(time_seconds)
            elif time_seconds is None:
                forfeit_count += 1
            else:
                raise ValueError(
                    f"Unexpected timeSeconds value in race {race.get('raceId')}: {time_seconds!r}"
                )

        if race_type == "normal" and players:
            winner = next((p for p in players if p.get("rank") == 1), None)
            if winner and isinstance(winner.get("timeSeconds"), (int, float)):
                normal_winner_times.append(winner["timeSeconds"])

    if player_result_count != completion_count + forfeit_count:
        raise ValueError("Player-result totals do not match completions plus forfeits.")

    average_normal_finish = (
        sum(normal_finish_times) / len(normal_finish_times) if normal_finish_times else None
    )
    average_normal_winner = (
        sum(normal_winner_times) / len(normal_winner_times) if normal_winner_times else None
    )

    return {
        "source": source_path.name,
        "totalRaces": len(races),
        "totalPlayerResults": player_result_count,
        "averageEntrantsPerRace": entrant_total / len(races) if races else 0,
        "completions": completion_count,
        "forfeits": forfeit_count,
        "completionRate": completion_count / player_result_count if player_result_count else 0,
        "normalRaceCount": race_type_counts.get("normal", 0),
        "normalFinishCount": len(normal_finish_times),
        "averageNormalFinishSeconds": average_normal_finish,
        "averageNormalFinishTime": format_duration(average_normal_finish) if average_normal_finish is not None else None,
        "normalWinnerCount": len(normal_winner_times),
        "averageNormalWinnerSeconds": average_normal_winner,
        "averageNormalWinnerTime": format_duration(average_normal_winner) if average_normal_winner is not None else None,
        "raceTypes": [
            {"type": race_type, "count": count}
            for race_type, count in sorted(
                race_type_counts.items(), key=lambda item: (-item[1], item[0].lower())
            )
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Generate overall OoT Bingo race statistics.")
    parser.add_argument("--input", type=Path, default=Path("bingo_races_fixed.json"), help="Source race JSON")
    parser.add_argument("--output", type=Path, default=Path("overall_stats.json"), help="Generated JSON output")
    args = parser.parse_args()

    if not args.input.is_file():
        parser.error(f"Input file not found: {args.input}")

    stats = generate_stats(args.input)
    args.output.write_text(
        json.dumps(stats, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print("Overall statistics generated successfully.")
    print(f"Races: {stats['totalRaces']:,}")
    print(f"Player results: {stats['totalPlayerResults']:,}")
    print(f"Completions: {stats['completions']:,}")
    print(f"Forfeits: {stats['forfeits']:,}")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
