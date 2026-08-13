import argparse
import csv
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat


def image_files(folder: Path):
    return sorted(folder.glob("rank_*"), key=lambda item: int(item.name.split("_")[1]))


def contact_sheet(files, destination: Path, columns=4, cell=420):
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell, rows * (cell + 48)), "#202020")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=22)
    for index, file in enumerate(files):
        image = Image.open(file).convert("RGB")
        thumb = ImageOps.contain(image, (cell - 20, cell - 20), Image.Resampling.LANCZOS)
        x = (index % columns) * cell + (cell - thumb.width) // 2
        y = (index // columns) * (cell + 48) + (cell - thumb.height) // 2
        sheet.paste(thumb, (x, y))
        draw.text(((index % columns) * cell + 12, (index // columns) * (cell + 48) + cell + 10), file.stem, fill="white", font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, quality=92)


def technical_metrics(file: Path):
    image = Image.open(file).convert("RGB")
    gray = ImageOps.grayscale(image)
    stat = ImageStat.Stat(gray)
    extrema = gray.getextrema()
    return {
        "file": str(file),
        "width": image.width,
        "height": image.height,
        "mean_luma": round(stat.mean[0], 2),
        "luma_stddev": round(stat.stddev[0], 2),
        "black_clip_pct": round(sum(1 for value in gray.resize((256, 256)).getdata() if value <= 5) / 65536 * 100, 3),
        "white_clip_pct": round(sum(1 for value in gray.resize((256, 256)).getdata() if value >= 250) / 65536 * 100, 3),
        "luma_min": extrema[0],
        "luma_max": extrema[1],
    }


def optimize(source: Path, destination: Path, crop_box=None, exposure=1.0, contrast=1.0, color=1.0, sharpness=1.0):
    image = Image.open(source).convert("RGB")
    if crop_box:
        image = image.crop(crop_box)
    image = ImageEnhance.Brightness(image).enhance(exposure)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Color(image).enhance(color)
    image = ImageEnhance.Sharpness(image).enhance(sharpness)
    image = ImageOps.fit(image, (2000, 2000), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=85, threshold=3))
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "JPEG", quality=94, optimize=True, progressive=True, subsampling=0)
    return {
        "source": str(source),
        "destination": str(destination),
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "width": image.width,
        "height": image.height,
        "bytes": destination.stat().st_size,
        "transform": {
            "crop_box": crop_box,
            "exposure": exposure,
            "contrast": contrast,
            "color": color,
            "sharpness": sharpness,
            "output": "2000x2000 JPEG quality 94",
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--config")
    args = parser.parse_args()
    root = Path(args.output)
    metrics = []
    for listing_id in ["4432511462", "878616671"]:
        folder = root / "SOURCE_IMAGES" / listing_id / "ORIGINAL_ETSY"
        files = image_files(folder)
        contact_sheet(files, root / "SOURCE_IMAGES" / listing_id / f"{listing_id}-contact-sheet.jpg")
        metrics.extend({"listing_id": listing_id, **technical_metrics(file)} for file in files)
    with (root / "SOURCE_IMAGES" / "technical-metrics.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(metrics[0].keys()))
        writer.writeheader()
        writer.writerows(metrics)

    if args.config:
        config = json.loads(Path(args.config).read_text(encoding="utf-8"))
        derivatives = []
        for item in config["derivatives"]:
            derivatives.append(optimize(
                Path(item["source"]),
                Path(item["destination"]),
                tuple(item["crop_box"]) if item.get("crop_box") else None,
                item.get("exposure", 1.0),
                item.get("contrast", 1.0),
                item.get("color", 1.0),
                item.get("sharpness", 1.0),
            ))
        (root / "DERIVED_IMAGES" / "derivative-manifest.json").write_text(
            json.dumps({"derivatives": derivatives}, indent=2) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
