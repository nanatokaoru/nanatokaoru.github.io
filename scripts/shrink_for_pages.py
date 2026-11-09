"""Shrink public/image so a GitHub Pages deploy stays under 1 GB.

GitHub Pages rejects sites larger than 1 GB, and this repo's scans are about
3.7 GB. The script runs in CI only: it rewrites the workspace copies to WebP
and points the data files at those files. The committed originals stay as they
are, so local `npm run dev` is unchanged.
"""

from __future__ import annotations

import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "public" / "image"
DATA_ROOT = ROOT / "src" / "data"
MAX_EDGE = 1100
QUALITY = 60
# Stay under GitHub's 1 GB (decimal) cap with room for the JS bundle.
SIZE_LIMIT = 900 * 1024 * 1024
PATH_EXT = re.compile(r"(/image/[^\"']+?)\.(?:jpe?g|png)\b", re.IGNORECASE)
BARE_EXT = re.compile(r"(?<=[\"'])\.(?:jpe?g|png)(?=[\"'])", re.IGNORECASE)


def convert(path_str: str) -> int:
    src = Path(path_str)
    dest = src.with_suffix(".webp")
    if dest.exists() and dest != src:
        raise RuntimeError(f"同名冲突：{dest}")
    with Image.open(src) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode == "P":
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        elif image.mode == "CMYK":
            image = image.convert("RGB")
        width, height = image.size
        long_edge = max(width, height)
        if long_edge > MAX_EDGE:
            scale = MAX_EDGE / long_edge
            image = image.resize(
                (max(1, round(width * scale)), max(1, round(height * scale))),
                Image.Resampling.LANCZOS,
            )
        image.save(dest, "WEBP", quality=QUALITY, method=4)
    size = dest.stat().st_size
    if dest != src:
        src.unlink()
    return size


def rewrite_sources() -> int:
    changed = 0
    for path in DATA_ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".json", ".ts"}:
            continue
        if "__tests__" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        updated = PATH_EXT.sub(lambda match: f"{match.group(1)}.webp", text)
        if path.name == "volume-page-ext.json":
            updated = BARE_EXT.sub(".webp", updated)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    sources = [
        path
        for path in IMAGE_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    ]
    if not sources:
        print("没有需要压缩的 jpg/png", file=sys.stderr)
        sys.exit(1)

    workers = min(4, os.cpu_count() or 2)
    total = 0
    done = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for size in pool.map(convert, (str(path) for path in sources), chunksize=8):
            total += size
            done += 1
            if done % 500 == 0 or done == len(sources):
                print(f"{done}/{len(sources)}  {total / 1024 / 1024:.0f} MB", flush=True)

    leftover = [
        path
        for path in IMAGE_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    ]
    if leftover:
        raise SystemExit(f"仍有 {len(leftover)} 张 jpg/png 没转成 webp")

    files = rewrite_sources()
    print(f"改写了 {files} 个数据文件，图片合计 {total / 1024 / 1024:.0f} MB")
    if total > SIZE_LIMIT:
        raise SystemExit(
            f"压缩后仍有 {total / 1024 / 1024:.0f} MB，超过 Pages 可用的 900 MB"
        )


if __name__ == "__main__":
    main()
