#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from _studio import configure_studio_imports


STUDIO_ROOT = configure_studio_imports()

from game_guide_studio.registry import RegistryError, SiteRegistry  # noqa: E402


ROLES = {
    "core": "核心成型件",
    "engine": "启动或转型信号",
    "transition": "前中期过渡件",
    "support": "辅助补强件",
}


def validate_bagbattle(root: Path, slug: str) -> dict:
    path = root / "content" / "secrets" / slug / "article.json"
    if not path.is_file():
        raise ValueError(f"文章不存在：{path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []
    if payload.get("section") != "builds":
        warnings.append("该文章不是构筑文章，不需要物品筛选资料")
    else:
        build_items = payload.get("buildItems") if isinstance(payload.get("buildItems"), dict) else {}
        for role, label in ROLES.items():
            entries = build_items.get(role)
            if not isinstance(entries, list) or not entries:
                errors.append(f"缺少{label}")
        notes = payload.get("buildNotes")
        if not isinstance(notes, list) or not any(str(note).strip() for note in notes):
            errors.append("缺少玩家注意事项")
        if not str(payload.get("archetype") or "").strip():
            errors.append("缺少流派 / 构筑名")
        if payload.get("recommendable") is not True:
            warnings.append("文章尚未加入物品筛选")
    return {"siteId": "bagbattle", "slug": slug, "path": str(path), "ok": not errors, "errors": errors, "warnings": warnings}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate one guide article before publishing")
    parser.add_argument("--site", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--registry", type=Path, default=STUDIO_ROOT / "sites.json")
    args = parser.parse_args()
    try:
        site = SiteRegistry(args.registry).get(args.site)
        if site.id != "bagbattle":
            raise ValueError(f"站点 {site.id} 当前没有标准文章级验证适配器；请运行该站点的 content:verify")
        result = validate_bagbattle(site.root, args.slug)
    except (RegistryError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
