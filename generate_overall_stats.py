
import json
import argparse
from pathlib import Path
from collections import Counter
from statistics import mean


def format_duration(seconds):
    """Convert seconds into H:MM:SS."""
    total_seconds = round(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    return f"{hours}:{minutes:02d}:{seconds:02d}"


def is_valid_time(value):
    """Check whether a time value is numeric."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def generate_stats(input_file, output_file):
    # Load the race data
    with open(input_file, "r", encoding="utf-8") as file:
        data = json.load(file)

    races = data["races"]

    # Collect all player results
    all_players = [
        player
        for race in races
        for player in race["players"]
    ]

    total_races = len(races)
    total_player_results = len(all_players)

    # Completion and forfeit statistics
    completions = [
        player for player in all_players
        if is_valid_time(player.get("timeSeconds"))
    ]

    forfeits = [
        player for player in all_players
        if player.get("timeSeconds") is None
    ]

    completion_count = len(completions)
    forfeit_count = len(forfeits)

    completion_rate = (
        completion_count / total_player_results
        if total_player_results else 0
    )

    average_entrants = (
        total_player_results / total_races
        if total_races else 0
    )

    # Unique players
    unique_usernames = {
        player["username"].strip().casefold()
        for player in all_players
        if isinstance(player.get("username"), str)
        and player["username"].strip()
    }

    unique_player_count = len(unique_usernames)

    # Most entrants in a single race
    largest_race = max(
        races,
        key=lambda race: len(race["players"]),
        default=None
    )

    most_entrants = (
        len(largest_race["players"])
        if largest_race else 0
    )

    largest_race_details = None

    if largest_race:
        largest_race_details = {
            "raceId": largest_race.get("raceId"),
            "seed": largest_race.get("seed"),
            "type": largest_race.get("type"),
            "date": largest_race.get("date")
        }

    # Normal race statistics
    normal_races = [
        race for race in races
        if race["type"] == "normal"
    ]

    normal_finishes = [
        player["timeSeconds"]
        for race in normal_races
        for player in race["players"]
        if is_valid_time(player.get("timeSeconds"))
    ]

    normal_winners = [
        player["timeSeconds"]
        for race in normal_races
        for player in race["players"]
        if player.get("rank") == 1
        and is_valid_time(player.get("timeSeconds"))
    ]

    average_normal_finish = (
        mean(normal_finishes)
        if normal_finishes else 0
    )

    average_normal_winner = (
        mean(normal_winners)
        if normal_winners else 0
    )

    # Race type counts
    race_type_counts = Counter(
        race["type"] for race in races
    )

    race_types = [
        {
            "type": race_type,
            "count": count
        }
        for race_type, count in sorted(
            race_type_counts.items(),
            key=lambda item: (-item[1], item[0])
        )
    ]

    # Build output
    stats = {
        "source": Path(input_file).name,
        "totalRaces": total_races,
        "totalPlayerResults": total_player_results,
        "uniquePlayers": unique_player_count,
        "averageEntrantsPerRace": average_entrants,
        "mostEntrantsInRace": most_entrants,
        "mostEntrantsRace": largest_race_details,
        "completions": completion_count,
        "forfeits": forfeit_count,
        "completionRate": completion_rate,
        "normalRaceCount": len(normal_races),
        "normalFinishCount": len(normal_finishes),
        "averageNormalFinishSeconds": average_normal_finish,
        "averageNormalFinishTime": (
            format_duration(average_normal_finish)
            if normal_finishes else "N/A"
        ),
        "normalWinnerCount": len(normal_winners),
        "averageNormalWinnerSeconds": average_normal_winner,
        "averageNormalWinnerTime": (
            format_duration(average_normal_winner)
            if normal_winners else "N/A"
        ),
        "raceTypes": race_types
    }

    # Write JSON output
    with open(output_file, "w", encoding="utf-8") as file:
        json.dump(
            stats,
            file,
            indent=2,
            ensure_ascii=False
        )

    print("========== CONVERSION COMPLETE ==========")
    print(f"Races: {total_races:,}")
    print(f"Player results: {total_player_results:,}")
    print(f"Unique players: {unique_player_count:,}")
    print(f"Most entrants in one race: {most_entrants:,}")
    print(f"Output written to: {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate overall Bingo race statistics."
    )

    parser.add_argument(
        "input",
        nargs="?",
        default="bingo_races_fixed.json",
        help="Input race JSON file"
    )

    parser.add_argument(
        "output",
        nargs="?",
        default="overall_stats.json",
        help="Output statistics JSON file"
    )

    args = parser.parse_args()

    generate_stats(args.input, args.output)
