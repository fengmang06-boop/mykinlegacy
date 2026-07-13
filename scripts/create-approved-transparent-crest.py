from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def is_external_background(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    maximum = max(pixel)
    chroma = maximum - min(pixel)
    return maximum <= 58 or (maximum <= 102 and chroma <= 24)


def connected_components(mask: bytearray, width: int, height: int) -> list[list[int]]:
    seen = bytearray(width * height)
    components: list[list[int]] = []
    for start in range(width * height):
        if not mask[start] or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        component: list[int] = []
        while queue:
            index = queue.popleft()
            component.append(index)
            x = index % width
            y = index // width
            if x > 0:
                neighbor = index - 1
                if mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = index + 1
                if mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = index - width
                if mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = index + width
                if mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
        components.append(component)
    return components


def make_preview(crest: Image.Image, background: Image.Image, output: Path) -> None:
    canvas = background.convert("RGBA")
    copy = crest.copy()
    copy.thumbnail((1040, 1040), Image.Resampling.LANCZOS)
    x = (canvas.width - copy.width) // 2
    y = (canvas.height - copy.height) // 2
    canvas.alpha_composite(copy, (x, y))
    canvas.convert("RGB").save(output, quality=96)


def checkerboard(size: int = 1200, tile: int = 36) -> Image.Image:
    image = Image.new("RGB", (size, size), (230, 230, 226))
    draw = ImageDraw.Draw(image)
    for y in range(0, size, tile):
        for x in range(0, size, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(190, 190, 184))
    return image


def decontaminate_edge_rgb(
    rgb: Image.Image, alpha: Image.Image, retained: Image.Image
) -> Image.Image:
    width, height = rgb.size
    colors = list(rgb.get_flattened_data())
    alpha_values = list(alpha.get_flattened_data())
    retained_values = list(retained.get_flattened_data())
    repaired = list(colors)

    for index, alpha_value in enumerate(alpha_values):
        if alpha_value == 0 or retained_values[index]:
            continue
        x = index % width
        y = index // width
        selected: tuple[int, int, int] | None = None
        for radius in (1, 2, 3, 4):
            candidates: list[tuple[int, int, int, int]] = []
            for candidate_y in range(max(0, y - radius), min(height, y + radius + 1)):
                for candidate_x in range(max(0, x - radius), min(width, x + radius + 1)):
                    candidate_index = candidate_y * width + candidate_x
                    if not retained_values[candidate_index]:
                        continue
                    distance = abs(candidate_x - x) + abs(candidate_y - y)
                    red, green, blue = colors[candidate_index]
                    candidates.append((distance, red, green, blue))
            if candidates:
                _, red, green, blue = min(candidates, key=lambda candidate: candidate[0])
                selected = (red, green, blue)
                break
        if selected is not None:
            repaired[index] = selected

    for index, alpha_value in enumerate(alpha_values):
        if alpha_value == 0:
            continue
        x = index % width
        y = index // width
        near_exterior = not retained_values[index]
        if not near_exterior:
            for candidate_y in range(max(0, y - 1), min(height, y + 2)):
                for candidate_x in range(max(0, x - 1), min(width, x + 2)):
                    if not retained_values[candidate_y * width + candidate_x]:
                        near_exterior = True
                        break
                if near_exterior:
                    break
        if not near_exterior:
            continue
        red, green, blue = repaired[index]
        maximum = max(red, green, blue)
        chroma = maximum - min(red, green, blue)
        if maximum >= 165 and blue >= 125 and chroma < 80:
            repaired[index] = (
                min(238, maximum),
                max(94, min(198, round(maximum * 0.78))),
                max(52, min(122, round(maximum * 0.48))),
            )

    output = Image.new("RGB", rgb.size)
    output.putdata(repaired)
    return output


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: create-approved-transparent-crest.py SOURCE OUTPUT PREVIEW_DIR")

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    preview_dir = Path(sys.argv[3])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(source_path).convert("RGB")
    width, height = source.size
    pixels = list(source.get_flattened_data())
    external = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(index: int) -> None:
        if not external[index] and is_external_background(pixels[index]):
            external[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x)
        seed((height - 1) * width + x)
    for y in range(height):
        seed(y * width)
        seed(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        for neighbor in (
            index - 1 if x > 0 else -1,
            index + 1 if x + 1 < width else -1,
            index - width if y > 0 else -1,
            index + width if y + 1 < height else -1,
        ):
            if neighbor >= 0 and not external[neighbor] and is_external_background(pixels[neighbor]):
                external[neighbor] = 1
                queue.append(neighbor)

    foreground = bytearray(0 if external[index] else 1 for index in range(width * height))
    components = connected_components(foreground, width, height)
    def retain_component(component: list[int]) -> bool:
        if len(component) >= 320:
            return True
        xs = [index % width for index in component]
        ys = [index // width for index in component]
        red = sum(pixels[index][0] for index in component) / len(component)
        green = sum(pixels[index][1] for index in component) / len(component)
        blue = sum(pixels[index][2] for index in component) / len(component)
        warm_metal = red >= 72 and red - blue >= 22 and red - green >= 8
        bottom_finial = min(ys) >= 1115 and 360 <= min(xs) and max(xs) <= 870
        ribbon_scroll = min(ys) >= 850 and (max(xs) <= 350 or min(xs) >= 900)
        return len(component) >= 24 and warm_metal and (bottom_finial or ribbon_scroll)

    retained_components = [component for component in components if retain_component(component)]
    retained = bytearray(width * height)
    for component in retained_components:
        for index in component:
            retained[index] = 1

    protected = Image.new("1", (width, height), 0)
    protected_draw = ImageDraw.Draw(protected)
    main_ribbon = [
        (360, 969),
        (894, 969),
        (906, 985),
        (906, 1075),
        (888, 1095),
        (366, 1095),
        (348, 1075),
        (348, 985),
    ]
    for polygon in (main_ribbon,):
        protected_draw.polygon(polygon, fill=1)
    protected_data = list(protected.get_flattened_data())
    for index, value in enumerate(protected_data):
        if value:
            retained[index] = 1

    xs: list[int] = []
    ys: list[int] = []
    for index, value in enumerate(retained):
        if value:
            xs.append(index % width)
            ys.append(index // width)
    if not xs:
        raise RuntimeError("transparent_crest_no_foreground")

    padding = 18
    left = max(0, min(xs) - padding)
    top = max(0, min(ys) - padding)
    right = min(width, max(xs) + padding + 1)
    bottom = min(height, max(ys) + padding + 1)

    alpha = Image.new("L", (width, height), 0)
    alpha.putdata([255 if value else 0 for value in retained])
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.72))
    rgba = source.convert("RGBA")
    rgba.putalpha(alpha)
    cropped = rgba.crop((left, top, right, bottom))

    rgb = cropped.convert("RGB")
    crop_alpha = cropped.getchannel("A")
    crop_retained = Image.new("L", (width, height), 0)
    crop_retained.putdata([255 if value else 0 for value in retained])
    crop_retained = crop_retained.crop((left, top, right, bottom))
    repaired = decontaminate_edge_rgb(rgb, crop_alpha, crop_retained)
    cropped = Image.merge("RGBA", (*repaired.split(), crop_alpha))
    cropped.save(output_path, optimize=True)

    checker_path = preview_dir / "transparent-crest-checkerboard.png"
    ivory_path = preview_dir / "transparent-crest-ivory.png"
    dark_path = preview_dir / "transparent-crest-dark.png"
    make_preview(cropped, checkerboard(), checker_path)
    make_preview(cropped, Image.new("RGB", (1200, 1200), (254, 251, 241)), ivory_path)
    make_preview(cropped, Image.new("RGB", (1200, 1200), (20, 17, 14)), dark_path)

    alpha_values = list(crop_alpha.get_flattened_data())
    report = {
        "method": "Four-neighbor flood fill from image borders, limited to neutral dark canvas pixels; disconnected background texture removed while warm-metal ribbon and finial details are retained; approved ribbon interior protected; 0.72px alpha feather; exterior edge pixels inherit the nearest retained crest color instead of channel-wise brightening; neutral pale highlights only in the exterior one-pixel boundary band are converted to antique gold before checks against exact certificate ivory, black, and checkerboard mattes.",
        "sourcePixels": [width, height],
        "cropBox": [left, top, right, bottom],
        "outputPixels": list(cropped.size),
        "connectedComponentsFound": len(components),
        "retainedComponents": len(retained_components),
        "transparentPixels": sum(1 for value in alpha_values if value == 0),
        "opaquePixels": sum(1 for value in alpha_values if value == 255),
        "antialiasedEdgePixels": sum(1 for value in alpha_values if 0 < value < 255),
        "output": str(output_path),
        "previews": [str(checker_path), str(ivory_path), str(dark_path)],
    }
    (preview_dir / "transparent-crest-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
