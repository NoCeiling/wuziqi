#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from _studio import configure_studio_imports


STUDIO_ROOT = configure_studio_imports()

from game_guide_studio.registry import RegistryError, SiteRegistry  # noqa: E402
from game_guide_studio.release import ReleaseError, plan_release, publish_site  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run or publish explicit game-guide files")
    parser.add_argument("--site", required=True)
    parser.add_argument("--files", nargs="+", required=True)
    parser.add_argument("--message", required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--registry", type=Path, default=STUDIO_ROOT / "sites.json")
    args = parser.parse_args()
    try:
        site = SiteRegistry(args.registry).get(args.site)
        if args.execute:
            result = publish_site(site, args.files, args.message, args.confirm)
        else:
            result = plan_release(site, args.files)
            result["notice"] = "dry-run only; add --execute --confirm <siteId> after explicit publish authorization"
    except (RegistryError, ReleaseError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
