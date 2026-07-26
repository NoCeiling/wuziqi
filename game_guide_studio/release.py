from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable

from .registry import SiteConfig


class ReleaseError(RuntimeError):
    pass


@dataclass
class CommandResult:
    command: list[str]
    returncode: int
    output: str

    def as_dict(self) -> dict:
        return {
            "command": self.command,
            "returncode": self.returncode,
            "output": self.output,
        }


def _run(command: list[str], root: Path, timeout: int = 600) -> CommandResult:
    try:
        completed = subprocess.run(
            command,
            cwd=root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ReleaseError(f"命令无法执行：{' '.join(command)}\n{exc}") from exc
    return CommandResult(
        command=command,
        returncode=completed.returncode,
        output=(completed.stdout + completed.stderr).strip(),
    )


def _git(site: SiteConfig, *args: str, check: bool = True) -> str:
    result = _run(["git", *args], site.root, timeout=120)
    if check and result.returncode != 0:
        raise ReleaseError(result.output or f"git {' '.join(args)} 执行失败")
    return result.output.strip()


def _read_vercel_project(site: SiteConfig) -> dict:
    path = site.root / ".vercel" / "project.json"
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def inspect_site(site: SiteConfig) -> dict:
    blockers: list[str] = []
    if not site.root.is_dir():
        blockers.append(f"站点目录不存在：{site.root}")
        return {**site.public_dict(), "root": str(site.root), "ready": False, "blockers": blockers}

    branch = _git(site, "branch", "--show-current", check=False)
    remote_name = str(site.git.get("remote") or "origin")
    remote_url = _git(site, "remote", "get-url", remote_name, check=False)
    allowed_urls = [str(value) for value in site.git.get("allowedUrls", [])]
    expected_branch = str(site.git.get("branch") or "")
    if expected_branch and branch != expected_branch:
        blockers.append(f"当前分支为 {branch or 'detached HEAD'}，要求 {expected_branch}")
    if not allowed_urls:
        blockers.append(str(site.git.get("blockedReason") or "尚未配置允许发布的 Git 远程仓库"))
    elif remote_url not in allowed_urls:
        blockers.append(f"Git 远程不在允许列表：{remote_url or '未配置'}")

    vercel_config = site.vercel
    project = _read_vercel_project(site)
    expected_project = str(vercel_config.get("projectName") or "")
    link_required = vercel_config.get("linkRequired", True) is True
    if link_required and not project:
        blockers.append("本地尚未连接 Vercel 项目（缺少 .vercel/project.json）")
    elif expected_project and project.get("projectName") != expected_project:
        blockers.append(
            f"Vercel 项目不匹配：{project.get('projectName') or '未知'}，要求 {expected_project}"
        )

    status = _git(site, "status", "--short", check=False)
    changed_count = len([line for line in status.splitlines() if line.strip()])
    return {
        **site.public_dict(),
        "root": str(site.root),
        "branch": branch,
        "expectedBranch": expected_branch,
        "remote": {"name": remote_name, "url": remote_url, "allowed": remote_url in allowed_urls},
        "vercel": {
            "linked": bool(project),
            "projectName": project.get("projectName") or expected_project or None,
            "projectId": project.get("projectId"),
        },
        "changedFiles": changed_count,
        "ready": not blockers,
        "blockers": blockers,
    }


def _normalize_relative_path(site: SiteConfig, value: str) -> str:
    raw = value.strip().replace("\\", "/")
    if not raw:
        raise ReleaseError("发布文件路径不能为空")
    candidate = (site.root / raw).resolve()
    try:
        relative = candidate.relative_to(site.root).as_posix()
    except ValueError as exc:
        raise ReleaseError(f"发布路径超出站点目录：{value}") from exc
    if relative in {"", "."}:
        raise ReleaseError("不能把整个站点根目录作为发布范围")
    if ".." in PurePosixPath(relative).parts:
        raise ReleaseError(f"发布路径无效：{value}")
    return relative


def _path_allowed(site: SiteConfig, relative: str) -> bool:
    allowed = [str(value).strip("/").replace("\\", "/") for value in site.publishing.get("allowedPaths", [])]
    return any(relative == prefix or relative.startswith(f"{prefix}/") for prefix in allowed if prefix)


def plan_release(site: SiteConfig, files: Iterable[str]) -> dict:
    status = inspect_site(site)
    normalized: list[str] = []
    for value in files:
        relative = _normalize_relative_path(site, value)
        if not _path_allowed(site, relative):
            raise ReleaseError(f"路径不在站点允许发布范围内：{relative}")
        if relative not in normalized:
            normalized.append(relative)
    changed = _git(site, "status", "--short", "--", *normalized, check=False) if normalized else ""
    return {
        "dryRun": True,
        "site": status,
        "files": normalized,
        "changes": [line for line in changed.splitlines() if line.strip()],
        "provider": "vercel-git",
        "next": "先执行 validate；实际推送必须显式使用 --execute --confirm <siteId>。",
    }


def validate_site(site: SiteConfig) -> list[CommandResult]:
    rows = site.commands.get("validate", [])
    if not isinstance(rows, list) or not rows:
        raise ReleaseError(f"站点 {site.id} 没有配置验证命令")
    results: list[CommandResult] = []
    for raw_command in rows:
        if not isinstance(raw_command, list) or not raw_command:
            raise ReleaseError(f"站点 {site.id} 的验证命令格式无效")
        result = _run([str(part) for part in raw_command], site.root)
        results.append(result)
        if result.returncode != 0:
            raise ReleaseError(result.output or f"验证失败：{' '.join(result.command)}")
    return results


def run_build(site: SiteConfig) -> CommandResult:
    raw_command = site.commands.get("build")
    if not isinstance(raw_command, list) or not raw_command:
        raise ReleaseError(f"站点 {site.id} 没有配置构建命令")
    return _run([str(part) for part in raw_command], site.root)


def publish_site(
    site: SiteConfig,
    files: Iterable[str],
    message: str,
    confirm: str,
) -> dict:
    plan = plan_release(site, files)
    status = plan["site"]
    if confirm != site.id:
        raise ReleaseError(f"确认值必须与 siteId 完全一致：{site.id}")
    if status["blockers"]:
        raise ReleaseError("发布被阻止：\n- " + "\n- ".join(status["blockers"]))
    if not plan["files"]:
        raise ReleaseError("实际发布必须显式指定至少一个文件或目录")
    if not message.strip():
        raise ReleaseError("提交说明不能为空")
    staged_before = _git(site, "diff", "--cached", "--name-only", check=False)
    if staged_before:
        raise ReleaseError("检测到已有暂存内容；为避免混入发布提交，请先单独处理这些内容")
    divergence = _git(site, "rev-list", "--left-right", "--count", "@{u}...HEAD", check=False)
    if not divergence:
        raise ReleaseError("当前分支没有可验证的上游分支")
    try:
        behind, ahead = [int(value) for value in divergence.split()]
    except (TypeError, ValueError) as exc:
        raise ReleaseError(f"无法判断分支同步状态：{divergence}") from exc
    if behind or ahead:
        raise ReleaseError(f"发布前分支必须与上游同步；当前 behind={behind}, ahead={ahead}")

    validation = validate_site(site)
    _git(site, "add", "--", *plan["files"])
    staged = _git(site, "diff", "--cached", "--name-only")
    staged_files = [line.strip() for line in staged.splitlines() if line.strip()]
    if not staged_files:
        raise ReleaseError("指定范围内没有可提交的变更")
    for relative in staged_files:
        if not _path_allowed(site, relative):
            raise ReleaseError(f"暂存区出现不允许发布的文件：{relative}")

    _git(site, "commit", "-m", message.strip())
    remote_name = str(site.git.get("remote") or "origin")
    branch = str(site.git.get("branch") or status["branch"])
    push = _run(["git", "push", remote_name, f"HEAD:{branch}"], site.root, timeout=300)
    if push.returncode != 0:
        raise ReleaseError(
            "提交已保留在本地，但推送失败。请先处理远程问题，不要重复提交。\n" + push.output
        )
    return {
        "siteId": site.id,
        "domain": site.domain,
        "branch": branch,
        "files": staged_files,
        "validation": [result.as_dict() for result in validation],
        "pushOutput": push.output,
        "vercel": "Git 推送完成，Vercel 将按项目集成自动部署。",
    }
