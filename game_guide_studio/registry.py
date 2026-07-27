from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SITE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class RegistryError(ValueError):
    pass


@dataclass(frozen=True)
class SiteConfig:
    raw: dict[str, Any]

    @property
    def id(self) -> str:
        return self.raw["id"]

    @property
    def name(self) -> str:
        return self.raw["name"]

    @property
    def root(self) -> Path:
        return Path(self.raw["root"]).resolve()

    @property
    def domain(self) -> str:
        return self.raw["domain"]

    @property
    def adapter(self) -> str:
        return self.raw["adapter"]

    @property
    def commands(self) -> dict[str, Any]:
        return self.raw.get("commands", {})

    @property
    def git(self) -> dict[str, Any]:
        return self.raw.get("git", {})

    @property
    def vercel(self) -> dict[str, Any]:
        return self.raw.get("vercel", {})

    @property
    def publishing(self) -> dict[str, Any]:
        return self.raw.get("publishing", {})

    def public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "domain": self.domain,
            "adapter": self.adapter,
            "provider": self.vercel.get("provider", "vercel"),
        }


class SiteRegistry:
    def __init__(self, path: Path) -> None:
        self.path = path.resolve()
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RegistryError(f"站点注册表无法读取：{self.path}") from exc
        if not isinstance(payload, dict) or payload.get("version") != 1:
            raise RegistryError("站点注册表 version 必须为 1")
        rows = payload.get("sites")
        if not isinstance(rows, list) or not rows:
            raise RegistryError("站点注册表至少需要一个站点")
        sites: dict[str, SiteConfig] = {}
        for row in rows:
            if not isinstance(row, dict):
                raise RegistryError("站点配置必须是对象")
            site_id = str(row.get("id") or "")
            if not SITE_ID_RE.fullmatch(site_id):
                raise RegistryError(f"站点 ID 无效：{site_id}")
            if site_id in sites:
                raise RegistryError(f"站点 ID 重复：{site_id}")
            for field in ("name", "root", "domain", "adapter"):
                if not str(row.get(field) or "").strip():
                    raise RegistryError(f"站点 {site_id} 缺少 {field}")
            if row.get("vercel", {}).get("provider") != "vercel":
                raise RegistryError(f"站点 {site_id} 当前只支持 Vercel 发布")
            sites[site_id] = SiteConfig(row)
        default_site = str(payload.get("defaultSite") or "")
        if default_site not in sites:
            raise RegistryError("defaultSite 不在 sites 中")
        self.default_site = default_site
        self._sites = sites

    def get(self, site_id: str | None = None) -> SiteConfig:
        selected = site_id or self.default_site
        try:
            return self._sites[selected]
        except KeyError as exc:
            raise RegistryError(f"未知站点：{selected}") from exc

    def all(self) -> list[SiteConfig]:
        return list(self._sites.values())
