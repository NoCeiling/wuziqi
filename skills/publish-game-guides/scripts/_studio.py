from __future__ import annotations

import os
import sys
from pathlib import Path


def locate_studio_root() -> Path:
    configured = os.environ.get("GAME_GUIDE_STUDIO_ROOT", "").strip()
    candidates = [
        Path(configured) if configured else None,
        Path(__file__).resolve().parents[3],
        Path(r"F:\bagbattle\game-guide-studio"),
        Path(r"F:\wuziqi"),
    ]
    for candidate in candidates:
        if candidate and (candidate / "sites.json").is_file() and (candidate / "game_guide_studio").is_dir():
            return candidate.resolve()
    raise RuntimeError(
        "Game Guide Studio not found. Set GAME_GUIDE_STUDIO_ROOT to the repository directory."
    )


def configure_studio_imports() -> Path:
    root = locate_studio_root()
    root_string = str(root)
    if root_string not in sys.path:
        sys.path.insert(0, root_string)
    return root
