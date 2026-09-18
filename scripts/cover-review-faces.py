#!/usr/bin/env python3
"""Cover faces with a light flower veil and a gold star, tracking each frame."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path("/Users/guldanaajtbaeva/Desktop/mu_alim")
FLOWER = ROOT / "server/uploads/review-flowers.jpg"
MODEL = ROOT / "scripts/face_detection_yunet_2023mar.onnx"

GOLD = (48, 168, 214)


def star_poly(cx: int, cy: int, outer: int, inner: int, points: int = 5) -> np.ndarray:
    pts = []
    for i in range(points * 2):
        radius = outer if i % 2 == 0 else inner
        angle = -math.pi / 2 + i * math.pi / points
        pts.append((int(cx + radius * math.cos(angle)), int(cy + radius * math.sin(angle))))
    return np.array(pts, dtype=np.int32)


def cover_face(frame: np.ndarray, flowers: np.ndarray, x: int, y: int, w: int, h: int) -> np.ndarray:
    pad = int(max(w, h) * 0.04)
    hgt, wid = frame.shape[:2]
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(wid, x + w + pad), min(hgt, y + h + pad)
    roi = frame[y0:y1, x0:x1]
    if roi.size == 0:
        return frame

    mh, mw = roi.shape[:2]
    k = max(31, (min(mh, mw) // 3) | 1)
    blurred = cv2.GaussianBlur(roi, (k, k), 0)
    cream = np.full_like(blurred, (236, 242, 248))
    flower = cv2.resize(flowers, (mw, mh), interpolation=cv2.INTER_AREA)
    frosted = blurred.astype(np.float32) * 0.28 + cream.astype(np.float32) * 0.22 + flower.astype(np.float32) * 0.50

    ell = np.zeros((mh, mw), np.uint8)
    cv2.ellipse(ell, (mw // 2, mh // 2), (max(1, mw // 2 - 2), max(1, mh // 2 - 2)), 0, 0, 360, 255, -1)
    ell = cv2.GaussianBlur(ell, (11, 11), 0)
    alpha = (ell.astype(np.float32) / 255.0)[..., None]
    mixed = frosted * alpha + roi.astype(np.float32) * (1.0 - alpha)
    out = mixed.astype(np.uint8)

    cx, cy = mw // 2, mh // 2
    outer = max(10, int(min(mw, mh) * 0.24))
    cv2.fillConvexPoly(out, star_poly(cx, cy, outer, int(outer * 0.42)), GOLD)
    cv2.polylines(out, [star_poly(cx, cy, outer, int(outer * 0.42))], True, (255, 255, 255), 1, cv2.LINE_AA)

    frame[y0:y1, x0:x1] = out
    return frame


def expand_face(
    x: float,
    y: float,
    w: float,
    h: float,
    frame_w: int,
    frame_h: int,
    nx: float | None = None,
    ny: float | None = None,
) -> tuple[int, int, int, int]:
    """Grow the tight YuNet box so the hijab and cheeks stay covered."""
    cx = nx if nx is not None else x + w / 2
    cy = (ny if ny is not None else y + h / 2) - h * 0.04
    nw = max(78.0, w * 1.22)
    nh = max(96.0, h * 1.38)
    x0 = int(round(cx - nw / 2))
    y0 = int(round(cy - nh / 2))
    x0 = max(0, min(frame_w - 8, x0))
    y0 = max(0, min(frame_h - 8, y0))
    nw_i = int(round(min(nw, frame_w - x0)))
    nh_i = int(round(min(nh, frame_h - y0)))
    return x0, y0, max(8, nw_i), max(8, nh_i)


Face = tuple[float, float, float, float, float, float]  # x, y, w, h, nose_x, nose_y


def detect_faces(detector: cv2.FaceDetectorYN, frame: np.ndarray) -> list[Face]:
    detector.setInputSize((frame.shape[1], frame.shape[0]))
    _, faces = detector.detect(frame)
    if faces is None:
        return []
    out: list[Face] = []
    for face in faces:
        x, y, w, h = float(face[0]), float(face[1]), float(face[2]), float(face[3])
        nx, ny = float(face[8]), float(face[9])
        score = float(face[-1])
        if w < 36 or h < 48 or score < 0.32:
            continue
        cy = y + h / 2
        if cy > frame.shape[0] * 0.58:
            continue
        out.append((x, y, w, h, nx, ny))
    return out


def box_center(box: tuple[float, ...]) -> tuple[float, float]:
    x, y, w, h = box[:4]
    return x + w / 2, y + h / 2


def flow_box(
    prev_gray: np.ndarray,
    gray: np.ndarray,
    box: tuple[float, float, float, float, float, float],
) -> tuple[float, float, float, float, float, float] | None:
    x, y, w, h, nx, ny = box
    x0, y0, x1, y1 = int(x), int(y), int(x + w), int(y + h)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(gray.shape[1], x1), min(gray.shape[0], y1)
    roi = prev_gray[y0:y1, x0:x1]
    if roi.size < 64:
        return None
    pts = cv2.goodFeaturesToTrack(roi, maxCorners=48, qualityLevel=0.01, minDistance=5)
    if pts is None or len(pts) < 8:
        return None
    pts = pts.copy()
    pts[:, 0, 0] += x0
    pts[:, 0, 1] += y0
    nxt, status, _err = cv2.calcOpticalFlowPyrLK(
        prev_gray,
        gray,
        pts,
        None,
        winSize=(21, 21),
        maxLevel=3,
        criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 20, 0.03),
    )
    if nxt is None or status is None:
        return None
    good = status.reshape(-1) == 1
    if int(good.sum()) < 8:
        return None
    delta = nxt[good] - pts[good]
    dx = float(np.median(delta[:, 0, 0]))
    dy = float(np.median(delta[:, 0, 1]))
    if abs(dx) > 40 or abs(dy) > 40:
        return None
    return (x + dx, y + dy, w, h, nx + dx, ny + dy)


def assign_faces(
    detections: list[Face],
    tracks: dict[str, Face | None],
) -> dict[str, Face | None]:
    unused = detections[:]
    assigned: dict[str, Face | None] = {name: None for name in tracks}
    names = [name for name, box in tracks.items() if box is not None]
    if not names and len(unused) >= 2:
        unused.sort(key=lambda d: d[0])
        assigned["left"] = unused[0]
        assigned["right"] = unused[-1]
        return assigned
    if not names and len(unused) == 1:
        assigned["left"] = unused[0]
        return assigned

    for name in names:
        last = tracks[name]
        assert last is not None
        lx, ly = box_center(last)
        best_i = -1
        best_d = 200.0
        for i, det in enumerate(unused):
            cx, cy = box_center(det)
            dist = math.hypot(cx - lx, cy - ly)
            if dist < best_d:
                best_d = dist
                best_i = i
        if best_i >= 0:
            assigned[name] = unused.pop(best_i)
    return assigned


def smooth(prev: Face | None, nxt: Face | None, alpha: float = 0.78) -> Face | None:
    if nxt is None:
        return prev
    if prev is None:
        return nxt
    return tuple(prev[i] * (1 - alpha) + nxt[i] * alpha for i in range(6))  # type: ignore[return-value]


def process(src: Path, dst: Path) -> None:
    flowers = cv2.imread(str(FLOWER))
    if flowers is None:
        raise SystemExit(f"missing flowers: {FLOWER}")
    if not MODEL.exists():
        raise SystemExit(f"missing YuNet model: {MODEL}")

    cap = cv2.VideoCapture(str(src))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    detector = cv2.FaceDetectorYN.create(str(MODEL), "", (width, height), 0.28, 0.3, 5000)

    dst.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(dst), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    tracks: dict[str, Face | None] = {"left": None, "right": None}
    prev_gray: np.ndarray | None = None

    for i in range(count):
        ok, frame = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detections = detect_faces(detector, frame)
        matched = assign_faces(detections, tracks)
        for name in tracks:
            nxt = matched[name]
            if nxt is None and tracks[name] is not None and prev_gray is not None:
                nxt = flow_box(prev_gray, gray, tracks[name])
            tracks[name] = smooth(tracks[name], nxt)
        covered = frame
        for box in tracks.values():
            if box is None:
                continue
            x, y, w, h, nx, ny = box
            ex, ey, ew, eh = expand_face(x, y, w, h, width, height, nx, ny)
            covered = cover_face(covered, flowers, ex, ey, ew, eh)
        writer.write(covered)
        prev_gray = gray
        if i % 80 == 0:
            print(f"{src.name} {i}/{count}")

    writer.release()
    cap.release()
    print(f"wrote {dst}")


def preview(src: Path, out: Path, frame_i: int) -> None:
    flowers = cv2.imread(str(FLOWER))
    cap = cv2.VideoCapture(str(src))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    detector = cv2.FaceDetectorYN.create(str(MODEL), "", (width, height), 0.28, 0.3, 5000)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_i)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit("preview frame missing")
    detections = detect_faces(detector, frame)
    detections.sort(key=lambda d: d[0])
    chosen = detections[:1] + detections[-1:] if len(detections) >= 2 else detections
    for x, y, w, h, nx, ny in chosen:
        bx, by, bw, bh = expand_face(x, y, w, h, frame.shape[1], frame.shape[0], nx, ny)
        frame = cover_face(frame, flowers, bx, by, bw, bh)
    cv2.imwrite(str(out), cv2.resize(frame, (360, int(360 * frame.shape[0] / frame.shape[1]))))
    print("preview", out, "faces", len(chosen))


JOBS = {
    "2047": {
        "src": ROOT / "server/uploads/reviews/family-img-2047.mp4",
        "dst": ROOT / "server/uploads/reviews/family-2047-flower-tmp.mp4",
        "preview_frames": [0, 80, 160, 240, 320],
    },
    "otzyv": {
        "src": ROOT / "server/uploads/reviews/family-otzyv-src.mp4",
        "dst": ROOT / "server/uploads/reviews/family-otzyv-flower-tmp.mp4",
        "preview_frames": [0, 200, 393, 500, 650, 780],
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("job", choices=["preview", "2047", "otzyv", "all", "file"])
    parser.add_argument("src", nargs="?", type=Path)
    parser.add_argument("dst", nargs="?", type=Path)
    args = parser.parse_args()
    if args.job == "file":
        if not args.src or not args.dst:
            raise SystemExit("usage: cover-review-faces.py file SRC DST")
        process(args.src, args.dst)
        return
    if args.job == "preview":
        for name, job in JOBS.items():
            for frame_i in job["preview_frames"]:
                preview(job["src"], ROOT / "scripts" / f"preview-{name}-f{frame_i}.jpg", frame_i)
        return
    targets = JOBS if args.job == "all" else {args.job: JOBS[args.job]}
    for job in targets.values():
        process(job["src"], job["dst"])


if __name__ == "__main__":
    main()
