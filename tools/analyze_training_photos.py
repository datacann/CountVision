from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    files = sorted(
        path
        for path in args.source.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    args.output.mkdir(parents=True, exist_ok=True)

    seen_hashes: dict[str, str] = {}
    records: list[dict[str, object]] = []
    thumbnails: list[tuple[str, np.ndarray]] = []

    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            records.append({"file": path.name, "readable": False})
            continue

        height, width = image.shape[:2]
        records.append(
            {
                "file": path.name,
                "readable": True,
                "width": width,
                "height": height,
                "sha256": digest,
                "duplicate_of": seen_hashes.get(digest),
                "mean_bgr": [round(float(value), 1) for value in image.mean(axis=(0, 1))],
                "blur_variance": round(float(cv2.Laplacian(image, cv2.CV_64F).var()), 1),
            }
        )
        seen_hashes.setdefault(digest, path.name)
        thumbnails.append((path.name, image))

    (args.output / "photo_analysis.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    per_page = 20
    cell_width, cell_height = 320, 235
    for page_index in range(0, len(thumbnails), per_page):
        page = np.full((cell_height * 4, cell_width * 5, 3), 245, dtype=np.uint8)
        for local_index, (name, image) in enumerate(
            thumbnails[page_index : page_index + per_page]
        ):
            row, col = divmod(local_index, 5)
            available_height = cell_height - 35
            scale = min(cell_width / image.shape[1], available_height / image.shape[0])
            resized = cv2.resize(
                image,
                (max(1, int(image.shape[1] * scale)), max(1, int(image.shape[0] * scale))),
                interpolation=cv2.INTER_AREA,
            )
            y = row * cell_height
            x = col * cell_width
            x_offset = x + (cell_width - resized.shape[1]) // 2
            page[y : y + resized.shape[0], x_offset : x_offset + resized.shape[1]] = resized
            label = f"{page_index + local_index + 1}: {name[:34]}"
            cv2.putText(
                page,
                label,
                (x + 6, y + cell_height - 12),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.38,
                (25, 25, 25),
                1,
                cv2.LINE_AA,
            )
        cv2.imwrite(str(args.output / f"contact_sheet_{page_index // per_page + 1}.jpg"), page)

    duplicate_count = sum(bool(record.get("duplicate_of")) for record in records)
    print(json.dumps({"files": len(files), "duplicates": duplicate_count, "pages": (len(thumbnails) + per_page - 1) // per_page}))


if __name__ == "__main__":
    main()
