#!/usr/bin/env python3
"""Loopback-only multi-site editor and release console for game guide sites."""

from __future__ import annotations

import argparse
import importlib.util
import json
import mimetypes
import os
import re
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import ModuleType
from urllib.parse import parse_qs, unquote, urlsplit

from game_guide_studio.registry import RegistryError, SiteConfig, SiteRegistry
from game_guide_studio.release import ReleaseError, inspect_site, plan_release, run_build


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
MAX_REQUEST_BYTES = 12 * 1024 * 1024
BUILD_LOCK = threading.Lock()
DEFAULT_HOSTED_ORIGINS = {
    "https://game-guide-studio.vercel.app",
    "https://wiziqigo.com",
    "https://www.wiziqigo.com",
    "https://wuziqigo.com",
    "https://www.wuziqigo.com",
}


def allowed_origins() -> set[str]:
    configured = {
        value.strip().rstrip("/")
        for value in os.environ.get("GAME_GUIDE_STUDIO_ORIGINS", "").split(",")
        if value.strip()
    }
    return DEFAULT_HOSTED_ORIGINS | configured


def origin_is_allowed(origin: str) -> bool:
    normalized = origin.strip().rstrip("/")
    if not normalized:
        return True
    parsed = urlsplit(normalized)
    if parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", "::1"}:
        return True
    return normalized in allowed_origins()


class StudioError(Exception):
    def __init__(self, message: str, status: int = HTTPStatus.BAD_REQUEST):
        super().__init__(message)
        self.status = status


def safe_child(root: Path, relative_path: str) -> Path:
    resolved_root = root.resolve()
    candidate = (resolved_root / relative_path).resolve()
    try:
        candidate.relative_to(resolved_root)
    except ValueError as exc:
        raise StudioError("路径超出允许范围") from exc
    return candidate


def load_bagbattle_module(site: SiteConfig) -> ModuleType:
    module_path = site.root / "tools" / "article_studio.py"
    if not module_path.is_file():
        raise StudioError(f"背包乱斗编辑适配器不存在：{module_path}", HTTPStatus.INTERNAL_SERVER_ERROR)
    root_string = str(site.root)
    if root_string not in sys.path:
        sys.path.insert(0, root_string)
    module_name = f"game_guide_studio_{site.id}_adapter"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise StudioError("无法载入背包乱斗编辑适配器", HTTPStatus.INTERNAL_SERVER_ERROR)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class SiteRuntime:
    def __init__(self, site: SiteConfig) -> None:
        self.site = site

    @property
    def editor_enabled(self) -> bool:
        return False

    def config(self) -> dict:
        release = inspect_site(self.site)
        return {
            "languages": {"zh-Hans": {"label": "简体中文"}},
            "professions": [],
            "sourceTypes": [],
            "factReviewStates": [],
            "editorialReviewStates": [],
            "ai": {"configured": False, "model": ""},
            "capabilities": {
                "editor": False,
                "items": False,
                "build": bool(self.site.commands.get("build")),
                "release": True,
            },
            "site": {**self.site.public_dict(), "release": release},
            "notice": "该站点已接入构建、验证和 Vercel 发布检查；文章编辑适配器尚未迁移。",
        }

    def list_articles(self) -> list[dict]:
        return []

    def list_items(self) -> list[dict]:
        return []

    def unavailable(self) -> None:
        raise StudioError("该站点当前只接入发布流程，尚不支持在工作台中编辑文章", HTTPStatus.NOT_IMPLEMENTED)

    def get_article(self, slug: str) -> dict:
        self.unavailable()
        return {}

    def create_article(self, payload: dict) -> dict:
        self.unavailable()
        return {}

    def save_article(self, slug: str, payload: dict) -> dict:
        self.unavailable()
        return {}

    def save_image(self, slug: str, payload: dict) -> dict:
        self.unavailable()
        return {}

    def preview(self, payload: dict) -> dict:
        self.unavailable()
        return {}

    def optimize(self, payload: dict) -> dict:
        self.unavailable()
        return {}

    def build(self) -> dict:
        result = run_build(self.site)
        return {"ok": result.returncode == 0, "output": result.output}

    def logo_path(self) -> Path:
        return safe_child(self.site.root, str(self.site.raw.get("logo") or "logo.png"))

    def article_asset(self, relative: str) -> Path:
        raise StudioError("该站点没有文章图片适配器", HTTPStatus.NOT_FOUND)

    def item_asset(self, relative: str) -> Path:
        raise StudioError("该站点没有物品图片适配器", HTTPStatus.NOT_FOUND)


class BagbattleRuntime(SiteRuntime):
    def __init__(self, site: SiteConfig) -> None:
        super().__init__(site)
        self.module = load_bagbattle_module(site)
        self.repository = self.module.ArticleRepository(root=site.root)

    @property
    def editor_enabled(self) -> bool:
        return True

    def config(self) -> dict:
        optimizer = self.module.OpenAIOptimizer()
        release = inspect_site(self.site)
        return {
            "languages": self.module.secrets_cms.LANGS,
            "professions": self.module.PROFESSIONS,
            "sourceTypes": self.module.SOURCE_TYPES,
            "factReviewStates": self.module.FACT_REVIEW_STATES,
            "editorialReviewStates": self.module.EDITORIAL_REVIEW_STATES,
            "ai": {"configured": optimizer.configured, "model": optimizer.model},
            "capabilities": {"editor": True, "items": True, "build": True, "release": True},
            "site": {**self.site.public_dict(), "release": release},
            "notice": "",
        }

    def list_articles(self) -> list[dict]:
        return self.repository.list_articles()

    def list_items(self) -> list[dict]:
        return self.repository.list_items()

    def get_article(self, slug: str) -> dict:
        return self.repository.get_article(slug)

    def create_article(self, payload: dict) -> dict:
        return self.repository.create_article(payload)

    def save_article(self, slug: str, payload: dict) -> dict:
        return self.repository.save_article(slug, payload)

    def save_image(self, slug: str, payload: dict) -> dict:
        return self.repository.save_image(
            slug,
            str(payload.get("filename") or ""),
            str(payload.get("contentType") or ""),
            str(payload.get("data") or ""),
        )

    def preview(self, payload: dict) -> dict:
        markdown = payload.get("markdown")
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        if not isinstance(markdown, str):
            raise StudioError("正文格式无效")
        return {
            "html": self.module.secrets_cms.render_markdown(markdown),
            "audit": self.module.article_audit(metadata, markdown),
        }

    def optimize(self, payload: dict) -> dict:
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        markdown = payload.get("markdown")
        if not isinstance(markdown, str):
            raise StudioError("正文格式无效")
        language = self.module.normalize_language(payload.get("language"))
        return self.module.OpenAIOptimizer().optimize(
            metadata,
            markdown,
            str(payload.get("mode") or "clarity"),
            language,
        )

    def article_asset(self, relative: str) -> Path:
        return safe_child(self.repository.asset_root, relative)

    def item_asset(self, relative: str) -> Path:
        return safe_child(self.repository.item_image_cache_root, relative)


def create_runtime(site: SiteConfig) -> SiteRuntime:
    if site.adapter == "bagbattle":
        return BagbattleRuntime(site)
    if site.adapter == "release-only":
        return SiteRuntime(site)
    raise StudioError(f"不支持的站点适配器：{site.adapter}", HTTPStatus.INTERNAL_SERVER_ERROR)


class StudioHandler(BaseHTTPRequestHandler):
    server_version = "GameGuideStudio/1.0"
    registry: SiteRegistry
    default_site: str
    runtimes: dict[str, SiteRuntime] = {}

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def _parsed(self):
        return urlsplit(self.path)

    def _origin(self) -> str:
        return self.headers.get("Origin", "").strip().rstrip("/")

    def _require_allowed_origin(self) -> None:
        if not origin_is_allowed(self._origin()):
            raise StudioError("不允许的工作台来源", HTTPStatus.FORBIDDEN)

    def _send_access_headers(self) -> None:
        origin = self._origin()
        if not origin or not origin_is_allowed(origin):
            return
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Guide-Site")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        if self.headers.get("Access-Control-Request-Private-Network", "").lower() == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _site_id(self) -> str:
        parsed = self._parsed()
        query_site = parse_qs(parsed.query).get("site", [""])[0]
        return self.headers.get("X-Guide-Site", "").strip() or query_site or self.default_site

    def _runtime(self) -> SiteRuntime:
        site = self.registry.get(self._site_id())
        if site.id not in self.runtimes:
            self.runtimes[site.id] = create_runtime(site)
        return self.runtimes[site.id]

    def _json_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise StudioError("请求长度无效") from exc
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise StudioError("请求为空或超过 12 MB", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise StudioError("请求 JSON 无效") from exc
        if not isinstance(payload, dict):
            raise StudioError("请求必须是 JSON 对象")
        return payload

    def _send_json(self, payload: object, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._send_access_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path) -> None:
        if not path.is_file():
            raise StudioError("文件不存在", HTTPStatus.NOT_FOUND)
        body = path.read_bytes()
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix == ".js":
            content_type = "text/javascript"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._send_access_headers()
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: https:; style-src 'self'; "
            "script-src 'self'; connect-src 'self' http://127.0.0.1:8770; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        self.end_headers()
        self.wfile.write(body)

    def _dispatch(self) -> None:
        parsed = self._parsed()
        path = unquote(parsed.path)
        if self.command == "GET":
            if path == "/":
                self.send_response(HTTPStatus.FOUND)
                self.send_header("Location", "/studio/")
                self._send_access_headers()
                self.end_headers()
                return
            if path in {"/studio", "/studio/"}:
                self._send_file(WEB_ROOT / "index.html")
                return
            if path.startswith("/studio/"):
                self._send_file(safe_child(WEB_ROOT, path.removeprefix("/studio/")))
                return
            if path == "/api/sites":
                rows = []
                for site in self.registry.all():
                    status = inspect_site(site)
                    rows.append({**site.public_dict(), "ready": status["ready"], "blockers": status["blockers"]})
                self._send_json({"defaultSite": self.default_site, "sites": rows})
                return
            runtime = self._runtime()
            if path in {"/logo.png", "/api/site-logo"}:
                self._send_file(runtime.logo_path())
                return
            if path.startswith("/assets/articles/"):
                self._send_file(runtime.article_asset(path.removeprefix("/assets/articles/")))
                return
            if path.startswith("/image-cache/"):
                self._send_file(runtime.item_asset(path.removeprefix("/image-cache/")))
                return
            if path == "/api/config":
                self._send_json(runtime.config())
                return
            if path == "/api/articles":
                self._send_json({"articles": runtime.list_articles()})
                return
            if path == "/api/items":
                self._send_json({"items": runtime.list_items()})
                return
            if path == "/api/release/status":
                self._send_json(inspect_site(runtime.site))
                return
            match = re.fullmatch(r"/api/articles/([a-z0-9-]+)", path)
            if match:
                self._send_json(runtime.get_article(match.group(1)))
                return

        if self.command == "POST":
            runtime = self._runtime()
            if path == "/api/articles":
                self._send_json(runtime.create_article(self._json_body()), HTTPStatus.CREATED)
                return
            if path == "/api/preview":
                self._send_json(runtime.preview(self._json_body()))
                return
            if path == "/api/ai/optimize":
                self._send_json(runtime.optimize(self._json_body()))
                return
            if path == "/api/release/plan":
                payload = self._json_body()
                files = payload.get("files") if isinstance(payload.get("files"), list) else []
                self._send_json(plan_release(runtime.site, [str(value) for value in files]))
                return
            match = re.fullmatch(r"/api/articles/([a-z0-9-]+)/images", path)
            if match:
                self._send_json(runtime.save_image(match.group(1), self._json_body()), HTTPStatus.CREATED)
                return
            if path == "/api/build":
                if not BUILD_LOCK.acquire(blocking=False):
                    raise StudioError("已有构建任务正在运行", HTTPStatus.CONFLICT)
                try:
                    result = runtime.build()
                finally:
                    BUILD_LOCK.release()
                self._send_json(result, HTTPStatus.OK if result["ok"] else HTTPStatus.INTERNAL_SERVER_ERROR)
                return

        if self.command == "PUT":
            runtime = self._runtime()
            match = re.fullmatch(r"/api/articles/([a-z0-9-]+)", path)
            if match:
                self._send_json(runtime.save_article(match.group(1), self._json_body()))
                return
        raise StudioError("接口不存在", HTTPStatus.NOT_FOUND)

    def do_GET(self) -> None:  # noqa: N802
        self._handle()

    def do_POST(self) -> None:  # noqa: N802
        self._handle()

    def do_PUT(self) -> None:  # noqa: N802
        self._handle()

    def do_OPTIONS(self) -> None:  # noqa: N802
        try:
            self._require_allowed_origin()
            self.send_response(HTTPStatus.NO_CONTENT)
            self._send_access_headers()
            self.end_headers()
        except StudioError as exc:
            self._send_json({"error": str(exc)}, int(exc.status))

    def _handle(self) -> None:
        try:
            self._require_allowed_origin()
            self._dispatch()
        except (StudioError, RegistryError, ReleaseError) as exc:
            self._send_json({"error": str(exc)}, int(getattr(exc, "status", HTTPStatus.BAD_REQUEST)))
        except Exception as exc:  # pragma: no cover
            self._send_json({"error": f"服务器错误：{exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Game Guide Studio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8770)
    parser.add_argument("--site", default="")
    parser.add_argument("--registry", type=Path, default=ROOT / "sites.json")
    args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("Game Guide Studio only accepts loopback hosts")
    registry = SiteRegistry(args.registry)
    default_site = registry.get(args.site or registry.default_site).id
    StudioHandler.registry = registry
    StudioHandler.default_site = default_site
    StudioHandler.runtimes = {}
    server = ThreadingHTTPServer((args.host, args.port), StudioHandler)
    print(f"Game Guide Studio: http://{args.host}:{args.port}/studio/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
