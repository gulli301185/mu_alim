#!/usr/bin/env python3
"""Rebuild qa-scene-full.jpg from pristine qa-komuz-scene source."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "client/public/qa-komuz-scene.jpg"
TARGET_HEIGHT = 626
TARGETS = [
    ROOT / "client/public/qa-scene-full.jpg",
    ROOT / "server/uploads/qa-scene-full.jpg",
]

QUOTE = (
    "Бул дүйнөнүн соңу өлүм менен бүткөн "
    "соң, эч кимге эч нерсеге капа "
    "болууга арзыбайт. Аларга өлүм "
    "насаат боло алат."
)
AUTHOR = "— Мухаммадалим Халил —"

NAVY = (26, 54, 109)
GOLD = (196, 152, 58)
GOLD_LIGHT = (224, 182, 90)


def trim_right_gutter(scene: Image.Image) -> Image.Image:
    arr = np.array(scene)
    sw = scene.width
    while sw > 0 and np.mean(arr[:, sw - 1]) > 250:
        sw -= 1
    return scene.crop((0, 0, sw, scene.height))


def prepare_scaled(scene: Image.Image) -> Image.Image:
    scale = TARGET_HEIGHT / scene.height
    scaled_w = max(1, int(round(scene.width * scale)))
    scaled = scene.resize((scaled_w, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    return scaled.filter(ImageFilter.UnsharpMask(radius=1.0, percent=70, threshold=2))


def load_font(size: int, bold: bool = False, italic: bool = False) -> ImageFont.FreeTypeFont:
    if italic:
        path = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
    elif bold:
        path = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
    else:
        path = "/System/Library/Fonts/Supplemental/Georgia.ttf"
    return ImageFont.truetype(path, size=size)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if font.getlength(trial) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def inpaint_quote_area(image_bgr: np.ndarray) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    # Remove the full old quote block (including opening quote mark on the left).
    cv2.rectangle(mask, (int(w * 0.44), int(h * 0.30)), (int(w * 0.995), int(h * 0.60)), 255, -1)

    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=3, sigmaY=3)
    _, mask = cv2.threshold(mask, 24, 255, cv2.THRESH_BINARY)

    return cv2.inpaint(image_bgr, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)


def draw_quote(image_rgb: Image.Image) -> Image.Image:
    draw = ImageDraw.Draw(image_rgb)
    w, h = image_rgb.size

    text_font = load_font(14)
    author_font = load_font(12, italic=True)
    quote_font = load_font(48, bold=True)

    x0 = int(w * 0.52)
    x1 = int(w * 0.97)
    max_width = x1 - x0
    lines = wrap_text(QUOTE, text_font, max_width)
    line_height = 22

    block_height = len(lines) * line_height + 40
    y0 = int(h * 0.455)

    draw.text((x0 - 12, y0 - 36), "“", font=quote_font, fill=GOLD)

    y = y0
    for line in lines:
        line_width = text_font.getlength(line)
        draw.text((x0 + (max_width - line_width) / 2, y), line, font=text_font, fill=NAVY)
        y += line_height

    draw.text((x1 - 36, y0 + block_height - 46), "”", font=quote_font, fill=GOLD)

    divider_y = y + 10
    divider_x0 = x0 + 10
    divider_x1 = x1 - 10
    draw.line([(divider_x0, divider_y), (divider_x1, divider_y)], fill=GOLD, width=1)
    mid_x = (divider_x0 + divider_x1) // 2
    draw.polygon(
        [
            (mid_x, divider_y - 4),
            (mid_x + 5, divider_y),
            (mid_x, divider_y + 4),
            (mid_x - 5, divider_y),
        ],
        fill=GOLD_LIGHT,
    )

    author_width = author_font.getlength(AUTHOR)
    draw.text(
        (x0 + (max_width - author_width) / 2, divider_y + 12),
        AUTHOR,
        font=author_font,
        fill=NAVY,
    )

    return image_rgb


def main() -> None:
    scene = trim_right_gutter(Image.open(ORIGINAL).convert("RGB"))
    scaled = prepare_scaled(scene)

    scaled_bgr = cv2.cvtColor(np.array(scaled), cv2.COLOR_RGB2BGR)
    cleaned_scaled_bgr = inpaint_quote_area(scaled_bgr)
    cleaned_scaled = Image.fromarray(cv2.cvtColor(cleaned_scaled_bgr, cv2.COLOR_BGR2RGB))

    canvas = cleaned_scaled
    final = draw_quote(canvas)

    for target in TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        final.save(target, quality=98, subsampling=0)
        print(f"Saved {target}")


if __name__ == "__main__":
    main()
