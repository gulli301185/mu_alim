#!/usr/bin/env python3
"""Darken and blur faces in the family course video review."""

from pathlib import Path

import cv2
import numpy as np

SRC = Path("/Users/guldanaajtbaeva/Desktop/mu_alim/server/uploads/reviews/family-img-2047.mp4")
DST = Path("/Users/guldanaajtbaeva/Desktop/mu_alim/server/uploads/reviews/family-img-2047-faces.mp4")
REF_FRAME = 160
# (x, y, w, h) on the reference frame
BOXES = {
    "left": (205, 515, 190, 230),
    "right": (475, 415, 170, 210),
}


def darken_ellipse(frame, x, y, w, h):
    pad = int(max(w, h) * 0.12)
    hgt, wid = frame.shape[:2]
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(wid, x + w + pad), min(hgt, y + h + pad)
    roi = frame[y0:y1, x0:x1]
    if roi.size == 0:
        return frame
    k = max(41, (min(roi.shape[0], roi.shape[1]) // 2) | 1)
    blurred = cv2.GaussianBlur(roi, (k, k), 0)
    darkened = (blurred.astype(np.float32) * 0.18).astype(np.uint8)
    mh, mw = roi.shape[:2]
    ell = np.zeros((mh, mw), np.uint8)
    cv2.ellipse(ell, (mw // 2, mh // 2), (max(1, mw // 2 - 2), max(1, mh // 2 - 2)), 0, 0, 360, 255, -1)
    ell = cv2.GaussianBlur(ell, (41, 41), 0)
    alpha = (ell.astype(np.float32) / 255.0)[..., None]
    mixed = darkened.astype(np.float32) * alpha + roi.astype(np.float32) * (1 - alpha)
    frame[y0:y1, x0:x1] = mixed.astype(np.uint8)
    return frame


def find(frame, tmpl, last, search=150):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    th, tw = tmpl.shape[:2]
    hgt, wid = gray.shape
    if last is None:
        x0, y0, x1, y1 = 0, int(hgt * 0.18), wid, int(hgt * 0.8)
    else:
        lx, ly = last
        x0 = max(0, lx - search)
        y0 = max(0, ly - search)
        x1 = min(wid, lx + tw + search)
        y1 = min(hgt, ly + th + search)
    roi = gray[y0:y1, x0:x1]
    if roi.shape[0] < th or roi.shape[1] < tw:
        return last if last else (0, 0)
    res = cv2.matchTemplate(roi, tmpl, cv2.TM_CCOEFF_NORMED)
    _, _, _, max_loc = cv2.minMaxLoc(res)
    return (x0 + max_loc[0], y0 + max_loc[1])


def main():
    cap = cv2.VideoCapture(str(SRC))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    cap.set(cv2.CAP_PROP_POS_FRAMES, REF_FRAME)
    ok, ref = cap.read()
    if not ok:
        raise SystemExit("Could not read reference frame")
    templates = {
        name: cv2.cvtColor(ref[y : y + h, x : x + w], cv2.COLOR_BGR2GRAY)
        for name, (x, y, w, h) in BOXES.items()
    }
    sizes = {name: (w, h) for name, (x, y, w, h) in BOXES.items()}

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(DST), fourcc, fps, (width, height))
    last = {name: None for name in templates}

    for i in range(count):
        ok, frame = cap.read()
        if not ok:
            break
        for name, tmpl in templates.items():
            x, y = find(frame, tmpl, last[name])
            last[name] = (x, y)
            w, h = sizes[name]
            frame = darken_ellipse(frame, x, y, w, h)
        writer.write(frame)
        if i % 50 == 0:
            print(f"{i}/{count}")

    writer.release()
    cap.release()
    print(f"wrote {DST}")


if __name__ == "__main__":
    main()
