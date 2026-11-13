"""Command line interface for local fixture runs."""

import argparse
import json
import sys
from pathlib import Path

from .solver import generate_timetable


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate a timetable proposal from JSON."
    )
    parser.add_argument("input", type=Path, help="Snapshot JSON file, or - for stdin")
    parser.add_argument(
        "-o", "--output", type=Path, help="Write response JSON to this file"
    )
    parser.add_argument(
        "--time-limit", type=float, default=10.0, help="CP-SAT time limit in seconds"
    )
    args = parser.parse_args()
    try:
        raw = json.load(
            sys.stdin if str(args.input) == "-" else args.input.open(encoding="utf-8")
        )
        result = generate_timetable(raw, time_limit_seconds=args.time_limit)
    except (OSError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    output = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)
    return 0 if result["status"] in {"FEASIBLE", "OPTIMAL"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
