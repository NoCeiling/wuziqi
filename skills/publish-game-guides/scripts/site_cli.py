#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys

from _studio import locate_studio_root


def main() -> int:
    root = locate_studio_root()
    command = [sys.executable, str(root / "scripts" / "site_release.py"), *sys.argv[1:]]
    return subprocess.call(command, cwd=root)


if __name__ == "__main__":
    raise SystemExit(main())
