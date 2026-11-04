"""Print a Markdown summary of a published dataset (used as the yearly-update pull request body).

Usage: python pipeline/scripts/summarise_update.py app/data/manifest.json
"""

from __future__ import annotations

import json
import sys


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def main(path: str) -> None:
    m = json.load(open(path, encoding="utf-8"))
    p, v, model = m["period"], m.get("validation"), m["model"]
    span = f"{p['firstNight']} to {p['lastNight']}"
    print(f"Automated data update: **{span}** ({len(p['years'])} years, {p['nights']:,} nights).\n")
    settings = f"±{model['windowDays']} days, neighbour weight {model['neighbourWeight']}"
    print(f"Model settings chosen by validation: {settings}.\n")
    if v:
        print(f"Tuned on {v['tuneYears']}, tested once on {v['testYears']}. Gate passed: **{v['gatePassed']}**.\n")
        print(
            "| Trip | Largest calibration gap | Skill vs season-blind | Skill vs season-only | Skill vs region-month |"
        )
        print("|---|---|---|---|---|")
        for r in v["results"]:
            s = r["skill"]
            cells = [
                f"{pct(s[k]['value'])} ({pct(s[k]['lo'])}–{pct(s[k]['hi'])})"
                for k in ("regionAllYear", "nationalMonth", "regionMonth")
            ]
            print(f"| {r['nights']} night(s) | {r['maxCalibrationGap'] * 100:.1f} pts | " + " | ".join(cells) + " |")
    st = m.get("stats", {})
    if st:
        print(f"\nDarkness vs clear-night correlation across regions: {st['darknessCloudCorrelation']:.2f}.")
    print("\nThe full report (tuning grid, reliability bins) is attached to the workflow run as `validation-report`.")
    print("Review the numbers against the previous release (docs/YEARLY_UPDATE.md › Reviewing), then merge to deploy.")


if __name__ == "__main__":
    main(sys.argv[1])
