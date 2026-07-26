#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from _studio import configure_studio_imports


STUDIO_ROOT = configure_studio_imports()

from game_guide_studio.registry import RegistryError, SiteRegistry  # noqa: E402
from game_guide_studio.release import ReleaseError, inspect_site  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a registered game-guide site")
    parser.add_argument("--site", required=True)
    parser.add_argument("--registry", type=Path, default=STUDIO_ROOT / "sites.json")
    args = parser.parse_args()
    try:
        status = inspect_site(SiteRegistry(args.registry).get(args.site))
    except (RegistryError, ReleaseError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
