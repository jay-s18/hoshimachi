"""Command line: `hoshimachi build | check | info`."""

from __future__ import annotations

import argparse
import logging
import sys

from . import inputs
from .config import load_config


def _cmd_build(args) -> int:
    from .build import GateFailed, run_build

    cfg = load_config(args.config)
    try:
        m = run_build(cfg, step=args.step, force=args.force, skip_validation=args.skip_validation)
    except GateFailed as e:
        logging.error("%s", e)
        return 2
    except inputs.InputError as e:
        logging.error("input problem: %s", e)
        return 1
    v = m.get("validation")
    print(f"Published {m['period']['firstNight']} to {m['period']['lastNight']} ({len(m['period']['years'])} years).")
    if v:
        print(
            f"Model: ±{m['model']['windowDays']} days, neighbour weight {m['model']['neighbourWeight']}; "
            f"gate passed: {v['gatePassed']}"
        )
    return 0


def _cmd_check(args) -> int:
    from .publish import check

    cfg = load_config(args.config)
    problems = check(cfg.paths.app_data_dir)
    for p in problems:
        print("✗", p)
    if not problems:
        print(f"✓ {cfg.paths.app_data_dir} matches its manifest")
    return 1 if problems else 0


def _cmd_info(args) -> int:
    cfg = load_config(args.config)
    clouds = inputs.load_clouds(cfg)
    ys = clouds.years
    print(
        f"Cloud record: {clouds.dates[0].date()} to {clouds.dates[-1].date()}, "
        f"{len(ys)} full years, grid {clouds.masks.shape[1:]}"
    )
    v = cfg.validation
    if len(ys) >= v.tune_years + v.test_years + 2:
        from .validation.run import Split

        s = Split.rolling(ys, v.tune_years, v.test_years)
        print(f"Validation would tune on {s.tune} and test on {s.test}.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="hoshimachi", description="Build and validate Hoshimachi's data.")
    ap.add_argument("--config", help="path to config.toml (default: the one in pipeline/)")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="build, validate and publish app/data")
    b.add_argument("--step", type=int, default=1, help="validate on every n-th start date (faster, for development)")
    b.add_argument("--force", action="store_true", help="publish even if the validation gate fails")
    b.add_argument("--skip-validation", action="store_true", help="development only: publish without validating")
    b.set_defaults(func=_cmd_build)

    sub.add_parser("check", help="verify app/data against its manifest").set_defaults(func=_cmd_check)
    sub.add_parser("info", help="describe the raw inputs and the validation split").set_defaults(func=_cmd_info)

    args = ap.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
