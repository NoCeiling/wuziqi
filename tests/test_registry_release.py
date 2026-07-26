from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game_guide_studio.registry import RegistryError, SiteConfig, SiteRegistry  # noqa: E402
from game_guide_studio.release import ReleaseError, inspect_site, plan_release  # noqa: E402


class RegistryTests(unittest.TestCase):
    def test_real_registry_contains_both_sites(self) -> None:
        registry = SiteRegistry(ROOT / "sites.json")
        self.assertEqual(registry.default_site, "bagbattle")
        self.assertEqual([site.id for site in registry.all()], ["bagbattle", "xwol"])
        self.assertEqual(registry.get("xwol").vercel["provider"], "vercel")

    def test_rejects_duplicate_site_ids(self) -> None:
        payload = {
            "version": 1,
            "defaultSite": "demo",
            "sites": [
                {"id": "demo", "name": "A", "root": "C:\\demo", "domain": "https://a.test", "adapter": "release-only", "vercel": {"provider": "vercel"}},
                {"id": "demo", "name": "B", "root": "C:\\demo2", "domain": "https://b.test", "adapter": "release-only", "vercel": {"provider": "vercel"}},
            ],
        }
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sites.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(RegistryError):
                SiteRegistry(path)


class ReleaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = SiteRegistry(ROOT / "sites.json")

    def test_bagbattle_release_target_is_owned_and_linked(self) -> None:
        status = inspect_site(self.registry.get("bagbattle"))
        self.assertEqual(status["remote"]["url"], "https://github.com/NoCeiling/bagbattle.git")
        self.assertEqual(status["vercel"]["projectName"], "bagbattle")
        self.assertTrue(status["ready"])

    def test_xwol_publish_is_blocked_by_remote_and_vercel_link(self) -> None:
        status = inspect_site(self.registry.get("xwol"))
        self.assertFalse(status["ready"])
        joined = "\n".join(status["blockers"])
        self.assertIn("ai-website-cloner-template", joined)
        self.assertIn(".vercel/project.json", joined)

    def test_plan_rejects_paths_outside_allowlist(self) -> None:
        site = self.registry.get("bagbattle")
        with patch("game_guide_studio.release.inspect_site", return_value={"blockers": []}), patch(
            "game_guide_studio.release._git", return_value=""
        ):
            with self.assertRaises(ReleaseError):
                plan_release(site, ["package.json"])

    def test_plan_never_accepts_repository_root(self) -> None:
        site = self.registry.get("bagbattle")
        with patch("game_guide_studio.release.inspect_site", return_value={"blockers": []}), patch(
            "game_guide_studio.release._git", return_value=""
        ):
            with self.assertRaises(ReleaseError):
                plan_release(site, ["."])


if __name__ == "__main__":
    unittest.main()
