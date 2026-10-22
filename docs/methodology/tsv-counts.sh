#!/usr/bin/env bash
# docs/methodology/tsv-counts.sh
# Read-only counts over the reviewer files (no database access).
# Run from the repository root:  bash docs/methodology/tsv-counts.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "== athar-review.tsv (rows, decisions)"
awk -F'\t' 'NR>1{rows++; d[$8]++} END{printf "rows=%d keep=%d drop=%d blank=%d\n", rows, d["keep"], d["drop"], d[""]}' docs/taxonomy/athar-review.tsv

echo "== ayah-review-decisions.tsv (rows, decisions)"
awk -F'\t' 'NR>1{rows++; d[$4]++} END{printf "rows=%d keep=%d drop=%d\n", rows, d["keep"], d["drop"]}' docs/taxonomy/ayah-review-decisions.tsv
awk 'END{printf "ayah-dropped.tsv rows=%d\n", NR-1}' docs/taxonomy/ayah-dropped.tsv

echo "== sahihayn-hadith-map.tsv (confidence; rows with targets)"
awk -F'\t' 'NR>1{rows++; c[$6]++; if($5!="") t++} END{printf "rows=%d high=%d low=%d blank_confidence=%d rows_with_targets=%d\n", rows, c["high"], c["low"], c[""], t}' docs/taxonomy/sahihayn-hadith-map.tsv
echo "-- low rows by book"
awk -F'\t' 'NR>1 && $6=="low"{b[$2]++} END{for(k in b) printf "%s\t%d\n", k, b[k]}' docs/taxonomy/sahihayn-hadith-map.tsv | sort
echo "-- low rows: top 12 topics (a row counts once per topic it names)"
awk -F'\t' 'NR>1 && $6=="low"{n=split($5,t,","); for(i=1;i<=n;i++) if(t[i]!="") top[t[i]]++} END{for(k in top) printf "%d\t%s\n", top[k], k}' docs/taxonomy/sahihayn-hadith-map.tsv | sort -rn | head -12
echo "-- low rows: distinct topics"
awk -F'\t' 'NR>1 && $6=="low"{n=split($5,t,","); for(i=1;i<=n;i++) if(t[i]!="") top[t[i]]=1} END{c=0; for(k in top) c++; print c}' docs/taxonomy/sahihayn-hadith-map.tsv

echo "== hadeethenc-map.tsv (rows with topics, confidence among them)"
awk -F'\t' 'NR>1{rows++; if($3!=""){t++; c[$4]++}} END{printf "rows=%d rows_with_topics=%d high_with_topics=%d low_with_topics=%d\n", rows, t, c["high"], c["low"]}' docs/taxonomy/hadeethenc-map.tsv

echo "== hand-written maps (chapter-level entries in YAML)"
printf "ibn-abi-dunya-map.yaml entries=%d\n" "$(grep -c '^  - { id:' backend/prisma/taxonomy/ibn-abi-dunya-map.yaml || true)"
printf "sahihayn-map.yaml entries=%d\n" "$(grep -c '^  - { id:' backend/prisma/taxonomy/sahihayn-map.yaml || true)"
printf "adhkar-map.yaml entries=%d\n" "$(grep -c '^  - { id:' backend/prisma/taxonomy/adhkar-map.yaml || true)"
echo "-- athar speakers by section"
awk '/^companions:/{s="companions"} /^senior-successors:/{s="senior-successors"} /^  - \{ key:/{n[s]++} END{for(k in n) printf "%s=%d\n", k, n[k]}' backend/prisma/taxonomy/athar-speakers.yaml
