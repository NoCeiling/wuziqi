#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game_guide_studio.registry import RegistryError, SiteRegistry  # noqa: E402
from game_guide_studio.release import (  # noqa: E402
    ReleaseError,
    inspect_site,
    plan_release,
    publish_site,
    run_build,
    validate_site,
)


def print_json(payload: object) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect, validate, and publish a registered game guide site")
    parser.add_argument("--registry", type=Path, default=ROOT / "sites.json")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List configured sites")
    for command in ("status", "build", "validate", "plan"):
        child = subparsers.add_parser(command)
        child.add_argument("--site", required=True)
        if command == "plan":
            child.add_argument("--files", nargs="*", default=[])

    publish = subparsers.add_parser("publish")
    publish.add_argument("--site", required=True)
    publish.add_argument("--files", nargs="+", required=True)
    publish.add_argument("--message", required=True)
    publish.add_argument("--execute", action="store_true")
    publish.add_argument("--confirm", default="")

    args = parser.parse_args()
    try:
        registry = SiteRegistry(args.registry)
        if args.command == "list":
            print_json({"defaultSite": registry.default_site, "sites": [site.public_dict() for site in registry.all()]})
            return 0
        site = registry.get(args.site)
        if args.command == "status":
            print_json(inspect_site(site))
            return 0
        if args.command == "build":
            result = run_build(site)
            print_json({"siteId": site.id, "result": result.as_dict()})
            return 0 if result.returncode == 0 else 1
        if args.command == "validate":
            print_json({"siteId": site.id, "results": [result.as_dict() for result in validate_site(site)]})
            return 0
        if args.command == "plan":
            print_json(plan_release(site, args.files))
            return 0
        if not args.execute:
            payload = plan_release(site, args.files)
            payload["notice"] = "这是 dry-run；实际发布需要补充 --execute --confirm <siteId>。"
            print_json(payload)
            return 0
        print_json(publish_site(site, args.files, args.message, args.confirm))
        return 0
    except (RegistryError, ReleaseError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
