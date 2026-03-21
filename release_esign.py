#!/usr/bin/env python3
"""
Update eSign/AltStore-style repo metadata for Noir releases.

Usage examples:
  python3 release_esign.py --description "Subtitle stability fixes."
  python3 release_esign.py --bump --description "New app build."
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_MODULES = [
    "NoirServices/Miruro/miruro.json",
    "NoirServices/AnimeKai/animekai.json",
    "NoirServices/TokyoInsider/tokyoinsider.json",
]


def bump_patch(version: str) -> str:
    parts = version.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid semver (expected x.y.z): {version}")
    major, minor, patch = parts
    return f"{major}.{minor}.{int(patch) + 1}"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def ensure_file(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"{label} not found: {path}")
    if not path.is_file():
        raise FileNotFoundError(f"{label} is not a file: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh Noir eSign repo metadata.")
    parser.add_argument(
        "--repo-json",
        default="repo.json",
        help="Path to repo.json (default: repo.json)",
    )
    parser.add_argument(
        "--ipa",
        default="build/Noir.ipa",
        help="Path to IPA file (default: build/Noir.ipa)",
    )
    parser.add_argument(
        "--description",
        default="Latest Noir app update.",
        help="Release notes text written into repo.json description fields.",
    )
    parser.add_argument(
        "--bump",
        action="store_true",
        help="Increment app + module versions by +0.0.1.",
    )
    parser.add_argument(
        "--modules",
        nargs="*",
        default=DEFAULT_MODULES,
        help="Module manifest JSON paths to bump when --bump is used.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would change without writing files.",
    )
    args = parser.parse_args()

    repo_json_path = Path(args.repo_json).resolve()
    ipa_path = Path(args.ipa).resolve()
    ensure_file(repo_json_path, "repo.json")
    ensure_file(ipa_path, "IPA")

    module_paths = [Path(m).resolve() for m in args.modules]
    if args.bump:
        for module_path in module_paths:
            ensure_file(module_path, "Module manifest")

    repo = read_json(repo_json_path)
    apps = repo.get("apps", [])
    if not apps:
        raise ValueError("repo.json has no apps[] entries")
    app = apps[0]
    versions = app.get("versions", [])
    if not versions:
        raise ValueError("repo.json apps[0] has no versions[] entries")
    latest = versions[0]

    now_iso = datetime.now().astimezone().replace(microsecond=0).isoformat()
    ipa_size = ipa_path.stat().st_size

    before_app_version = str(app.get("version", "0.0.0"))
    after_app_version = before_app_version

    if args.bump:
        after_app_version = bump_patch(before_app_version)
        app["version"] = after_app_version
        latest["version"] = bump_patch(str(latest.get("version", before_app_version)))

    app["versionDate"] = now_iso
    app["versionDescription"] = args.description
    latest["date"] = now_iso
    latest["localizedDescription"] = args.description
    latest["size"] = ipa_size

    module_updates: list[tuple[str, str, str]] = []
    if args.bump:
        for module_path in module_paths:
            module = read_json(module_path)
            old_v = str(module.get("version", "0.0.0"))
            new_v = bump_patch(old_v)
            module["version"] = new_v
            module_updates.append((str(module_path), old_v, new_v))
            if not args.dry_run:
                write_json(module_path, module)

    if args.dry_run:
        print("[dry-run] repo.json:", repo_json_path)
        print(f"[dry-run] app version: {before_app_version} -> {after_app_version}")
        print(f"[dry-run] timestamp: {now_iso}")
        print(f"[dry-run] ipa size: {ipa_size}")
        for p, old_v, new_v in module_updates:
            print(f"[dry-run] module {p}: {old_v} -> {new_v}")
        return 0

    write_json(repo_json_path, repo)

    print("Updated eSign metadata successfully.")
    print(f"repo.json: {repo_json_path}")
    print(f"App version: {before_app_version} -> {after_app_version}")
    print(f"Timestamp: {now_iso}")
    print(f"IPA size: {ipa_size}")
    if module_updates:
        print("Module versions:")
        for p, old_v, new_v in module_updates:
            print(f"  - {p}: {old_v} -> {new_v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
