#!/usr/bin/env python3
"""
Validation script for hadeethenc-map.tsv.
Checks:
- Row count = 1,454
- IDs identical to input
- Every slug exists in allowed set (no contemporary/hidden)
- Prints counts (assigned high / low / empty) and top 30 topics
"""

import csv
import random

TSV_IN = "/Users/moedad/Documents/work/Personal Projects/Thekra/docs/taxonomy/hadeethenc-unlinked.tsv"
TSV_OUT = "/Users/moedad/Documents/work/Personal Projects/Thekra/docs/taxonomy/hadeethenc-map.tsv"

# All allowed slugs (not contemporary:true, not hidden:true)
ALLOWED_SLUGS = {
    # AVOID
    "shirk", "sihr-kahana", "tatayyur", "takdhib-qadar", "amn-makr", "bida",
    "hilf-bighayr-allah", "sabb-sahaba",
    "riya", "kibr", "hasad", "ghadab", "tul-amal", "istihana-saghair",
    "ghibah", "namimah", "kadhib", "shahadat-zur", "yamin-ghamus", "sabb-lan",
    "dhul-wajhayn", "jidal", "qadhf", "sukhriya",
    "uquq", "qat-al-rahim", "nushuz", "zulm-zawja", "intisab", "dayyuth",
    "zulm", "adha-jar", "adha-muslimin", "tajassus", "su-dhann", "hijran",
    "ghadr", "khiyana", "mann", "baghy-fakhr", "tadhib-hayawan", "niyaha",
    "riba", "akl-mal-yatim", "ghish", "sariqa", "rishwa", "akl-haram",
    "mutl", "man-ajr", "ihtikar", "bukhl", "man-zakah", "israf", "masala", "qimar",
    "zina", "liwat", "nazar-muharram", "khamr", "tashabbuh", "tabarruj",
    "isbal-harir", "malahi",
    "qatl", "intihar", "zulm-raiyya",
    "tark-as-salah", "iftar-ramadan", "tark-hajj", "tanazzuh-bawl", "hajr-quran",
    "kitman-ilm", "qawl-bila-amal",
    "idaat-al-waqt",
    # DO
    "tawhid", "ikhlas", "tawba", "sabr", "muhasaba", "tark-lillah", "sidq",
    "muraqaba", "tawakkul", "khawf-raja", "shukr", "zuhd", "tawadu",
    "mahabbat-allah", "sunna", "wara", "salamat-sadr", "husn-khuluq", "haya",
    "kaff-al-ghadab", "ightinam-waqt",
    "salah", "adab-salah", "salat-fi-jamaah", "nawafil", "jumua", "tahara",
    "zakah", "sadaqah", "siyam", "hajj", "quran", "dhikr", "dua", "salat-ala-nabi",
    "hifz-al-lisan", "kalam-tayyib", "islah-bayn-nas", "tathabbut", "nasiha",
    "amr-maruf",
    "birr-al-walidayn", "silat-ar-rahim", "husn-ishra", "nafaqa-ahl", "nikah",
    "kafalat-yatim",
    "haqq-jar", "ikram-dayf", "qada-hawaij", "satr-muslim", "hubb-fillah",
    "afw", "amana-wafa", "adl", "salam", "iyadat-marid", "imatat-adha",
    "rahma-khalq", "taawun",
    "kasb-halal", "samaha", "iqtisad",
    "talab-ilm", "nashr-ilm",
    "ghadd-basar", "iffa",
    "dhikr-akhira", "iman-ghayb",
    "adab-taam", "adab-safar", "adab-libas", "adab-masjid", "adab-majlis",
    "tawqir-kibar", "taat-wulat",
}

print("=" * 60)
print("VALIDATION: hadeethenc-map.tsv")
print("=" * 60)

# Read input IDs
input_ids = []
with open(TSV_IN, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for r in reader:
        input_ids.append(r['id'])

print(f"Input rows (hadeethenc-unlinked.tsv): {len(input_ids)}")

# Read output
out_rows = []
with open(TSV_OUT, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for r in reader:
        out_rows.append(r)

print(f"Output rows (hadeethenc-map.tsv):     {len(out_rows)}")

# Check 1: row count
assert len(out_rows) == 1454, f"FAIL: expected 1454 rows, got {len(out_rows)}"
print(f"✓ Row count = 1454")

# Check 2: IDs identical
out_ids = [r['id'] for r in out_rows]
assert out_ids == input_ids, "FAIL: IDs don't match input"
print(f"✓ IDs match input exactly")

# Check 3: all slugs valid
errors = []
for r in out_rows:
    if r['topics']:
        for slug in r['topics'].split(','):
            slug = slug.strip()
            if slug and slug not in ALLOWED_SLUGS:
                errors.append(f"  hadith {r['id']}: invalid slug '{slug}'")

if errors:
    print(f"✗ Invalid slugs found:")
    for e in errors:
        print(e)
else:
    print(f"✓ All slugs are valid and allowed")

# Check 4: confidence values
bad_conf = [r for r in out_rows if r['confidence'] not in ('high', 'low')]
if bad_conf:
    print(f"✗ Invalid confidence values: {[r['id'] for r in bad_conf]}")
else:
    print(f"✓ All confidence values are 'high' or 'low'")

print()
print("─" * 60)
print("COUNTS")
print("─" * 60)

from collections import Counter

assigned_high = [r for r in out_rows if r['topics'] and r['confidence'] == 'high']
assigned_low  = [r for r in out_rows if r['topics'] and r['confidence'] == 'low']
empty         = [r for r in out_rows if not r['topics']]

print(f"Assigned high confidence: {len(assigned_high)}")
print(f"Assigned low confidence:  {len(assigned_low)}")
print(f"Empty (unassigned):       {len(empty)}")
print(f"Total:                    {len(out_rows)}")
print()

# Topic counts
topic_counter = Counter()
for r in out_rows:
    if r['topics']:
        for s in r['topics'].split(','):
            s = s.strip()
            if s:
                topic_counter[s] += 1

print("─" * 60)
print("TOP 30 TOPICS BY COUNT")
print("─" * 60)
for slug, cnt in topic_counter.most_common(30):
    print(f"  {slug:<30} {cnt}")

print()
print("─" * 60)
print("30 RANDOM HIGH-CONFIDENCE EXAMPLES")
print("─" * 60)
random.seed(42)
sample = random.sample(assigned_high, min(30, len(assigned_high)))
for r in sorted(sample, key=lambda x: x['id']):
    print(f"  [{r['id']}] {r['title'][:55]}")
    print(f"        → {r['topics']}  ({r['reason']})")

print()
print("=" * 60)
print("VALIDATION COMPLETE")
print("=" * 60)
