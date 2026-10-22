"""Write quran-detector matches as JSON for the TypeScript importer.

Word indexes match str.split() / a \\S+ scan. end_word is exclusive.
Surah numbers come from the package's own index so the names match.
"""

from __future__ import annotations

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from importlib.resources import files

from quran_detector import Settings, detect


def surah_numbers() -> dict[str, int]:
    index = files("quran_detector").joinpath("data/quran-index.xml")
    root = ET.parse(index).getroot()
    numbers: dict[str, int] = {}
    for sura in root.findall("sura"):
        name = sura.get("name")
        raw = sura.get("index")
        if name and raw:
            numbers[name] = int(raw)
    return numbers


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    text = open(args.input, encoding="utf-8").read()
    names = surah_numbers()
    settings = Settings(find_missing=False, find_errors=True, min_match=3)
    matches = []
    clamped = 0
    for match in detect(text, settings=settings):
        surah = names.get(match["surah_name"])
        if surah is None:
            raise SystemExit(f"unknown surah name: {match['surah_name']}")
        verses = match.get("verses") or []
        counts = [len(str(verse).split()) for verse in verses]
        matched = sum(counts)
        first = counts[0] if counts else 0
        start = int(match["start_in_text"])
        end = int(match["end_in_text"])
        ayah_start = int(match["aya_start"])
        ayah_end = int(match["aya_end"])
        # The detector extends end_in_text when the next ayah number appears
        # anywhere later in the book. That span is not one quotation.
        if matched > 0 and end - start > matched * 3 + 8:
            end = start + first + 2
            ayah_end = ayah_start
            matched = first
            clamped += 1
        if not (0 <= start < end):
            continue
        matches.append(
            {
                "start_word": start,
                "end_word": end,
                "surah": surah,
                "ayah_start": ayah_start,
                "ayah_end": ayah_end,
                "matched_words": matched,
            }
        )
    if clamped:
        print(f"quran-detector clamped {clamped} non-contiguous spans", file=sys.stderr)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump({"matches": matches}, handle, ensure_ascii=False)


if __name__ == "__main__":
    main()
