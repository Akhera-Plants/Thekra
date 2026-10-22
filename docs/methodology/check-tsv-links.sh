#!/usr/bin/env bash
# docs/methodology/check-tsv-links.sh
# Joins the reviewer files to the database with read-only SELECTs (queries-tsv.sql).
# Run from the repository root:  bash docs/methodology/check-tsv-links.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
URL="${THEKRA_DATABASE_URL:-postgresql://thekra:thekra_dev_password@localhost:5432/thekra}"

# ids_of FILE FIELD VALUE IDCOL -> 'id1','id2',...  (rows with FIELD == VALUE; FIELD 0 = all rows)
ids_of() {
  awk -F'\t' -v f="$2" -v v="$3" -v c="$4" '
    NR>1 && (f==0 || $f==v) { id=$c; gsub(/\047/, "", id); printf "%s\047%s\047", (n++ ? "," : ""), id }
    END { if (n==0) printf "\047\047" }' "$1"
}
LOW=$(ids_of docs/taxonomy/sahihayn-hadith-map.tsv 6 low 1)
HIGH=$(ids_of docs/taxonomy/sahihayn-hadith-map.tsv 6 high 1)
KEEP=$(ids_of docs/taxonomy/athar-review.tsv 8 keep 1)
DROP=$(ids_of docs/taxonomy/athar-review.tsv 8 drop 1)
HE=$(awk -F'\t' 'NR>1 && $3!="" { id=$1; gsub(/\047/, "", id); printf "%s\047%s\047", (n++ ? "," : ""), id } END { if (n==0) printf "\047\047" }' docs/taxonomy/hadeethenc-map.tsv)  # rows that name a topic
AYAH=$(ids_of docs/taxonomy/ayah-dropped.tsv 0 "" 1)

psql "$URL" -v ON_ERROR_STOP=1 -P pager=off \
  -v low_ids="$LOW" -v high_ids="$HIGH" -v keep_ids="$KEEP" -v drop_ids="$DROP" \
  -v he_ids="$HE" -v ayah_drop_link_ids="$AYAH" \
  -f docs/methodology/queries-tsv.sql
