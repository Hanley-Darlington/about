#!/usr/bin/env python3
"""
Simple JPG → WebP converter.

- Reads from  FullJPGs/
- Writes to  ConvWEBP/ (mirrors subfolders)
- Skips files if output is already newer
- Fixes EXIF orientation
- Converts non-RGB modes to RGB

Run:
    python convert.py
"""

from pathlib import Path
from PIL import Image, ImageOps

INPUT_DIR  = Path("convert/FullJPGs")
OUTPUT_DIR = Path("convert/ConvWEBP")
QUALITY    = 80   # WebP quality (0–100)

EXTS = {".jpg", ".jpeg"}

def to_webp_path(src: Path, root_in: Path, root_out: Path) -> Path:
    rel = src.relative_to(root_in)
    return (root_out / rel).with_suffix(".webp")

def newer(dst: Path, src: Path) -> bool:
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime

def convert_one(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.save(
            dst,
            format="WEBP",
            quality=QUALITY,
            method=6,    # best compression effort (0–6)
            optimize=True,
            lossless=False,
        )

def main():
    if not INPUT_DIR.exists():
        print(f"❌ Input folder not found: {INPUT_DIR.resolve()}")
        return
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total, done, skipped = 0, 0, 0
    for src in INPUT_DIR.rglob("*"):
        if src.is_file() and src.suffix.lower() in EXTS:
            total += 1
            dst = to_webp_path(src, INPUT_DIR, OUTPUT_DIR)
            if newer(dst, src):
                skipped += 1
                continue
            print(f"→ {src}  ⇒  {dst}")
            convert_one(src, dst)
            done += 1

    print("\n✅ Finished")
    print(f"  Found:    {total} JPGs")
    print(f"  Converted {done}")
    print(f"  Skipped:  {skipped} (already up-to-date)")
    print(f"  Output folder: {OUTPUT_DIR.resolve()}")

if __name__ == "__main__":
    main()
