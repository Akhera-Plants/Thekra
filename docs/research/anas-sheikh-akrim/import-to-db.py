"""Load the lecturer's hadith and athar from citations.yaml into the site database.

Owner rule (2026-10-28): a hadith Anas Sheikh Akrim cites is shown in his wording with the grade he
stated; when he stated none it is sahih. Entries he weakened, and entries whose wording the transcript
lost, are skipped. Owner approved writing straight to production the same day.

Rows are new (nothing existing is changed). Batch: 2026-10-anas-habits.
Revert:
  delete from "GoodDeedQuote" where "quoteId" in (select id from "Quote" where "importBatch" = '2026-10-anas-habits');
  delete from "SinQuote"      where "quoteId" in (select id from "Quote" where "importBatch" = '2026-10-anas-habits');
  delete from "Quote" where "importBatch" = '2026-10-anas-habits';
  delete from "Source" where name = 'Lectures of Anas Sheikh Akrim' and not exists (select 1 from "Quote" q where q."sourceId" = "Source".id);

Usage: NEON_URL=... python3 -I import-to-db.py [--apply]   (without --apply it prints the plan only)
The connection string is read from the environment and never written anywhere.
"""
import json, os, sys, urllib.request, uuid
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
BATCH = '2026-10-anas-habits'
PROVIDER = 'lecture:anas-sheikh-akrim'
VIDEO = '4EkrbmmIlno'
SOURCE_NAME = 'Lectures of Anas Sheikh Akrim'
SOURCE_NAME_AR = 'محاضرات الأستاذ أنس شيخ اكريم'
AUTHORITY = 'الأستاذ أنس شيخ اكريم'
EPISODE = 'حلقة «بناء العادات»'
NOTE = 'أورده الأستاذ أنس شيخ اكريم في حلقة «بناء العادات»'

# What he said about where the hadith is (shown next to the grade).
HIS_SOURCE = {
    'adwamuha-wa-in-qall': 'وعزاه إلى البخاري',
    'ma-tutiqun': 'وعزاه إلى البخاري',
    'abdullah-ibn-amr': 'وعزاه إلى البخاري وغيره',
    'yatakhawwaluna': 'وعزاه إلى البخاري',
    'amarahum-bima-yutiqun': 'وعزاه إلى البخاري',
    'awsani-khalili': 'وعزاه إلى البخاري',
    'imatat-al-adha': 'وقال: حديث صحيح',
}

# Topic links: only where the text is plainly about the topic.
LINKS = {
    'adwamuha-wa-in-qall': ['D:nawafil'],
    'ma-tutiqun': ['D:nawafil'],
    'abdullah-ibn-amr': ['D:nawafil', 'D:quran', 'D:siyam'],
    'salman-abu-darda': ['D:nawafil', 'D:husn-ishra'],
    'ad-din-yusr': ['D:nawafil'],
    'matin-awghil': ['D:nawafil'],
    'yatakhawwaluna': ['D:nashr-ilm'],
    'man-nama-an-salat': ['D:salah'],
    'amarahum-bima-yutiqun': ['D:nawafil'],
    'awsani-khalili': ['D:nawafil', 'D:siyam'],
    'ahl-ad-duthur': ['D:dhikr'],
    'la-tahqiranna': ['D:kalam-tayyib'],
    'shiqq-tamra': ['D:sadaqah'],
    'tabassum-sadaqa': ['D:kalam-tayyib'],
    'baghi-kalb': ['D:rahma-khalq'],
    'imatat-al-adha': ['D:imatat-adha'],
    'hirra': ['S:tadhib-hayawan', 'D:rahma-khalq'],
    'jiran-imra-atan': ['S:adha-jar', 'D:haqq-jar'],
    'ikhlas-thuluth': ['D:quran'],
    'husn-al-khuluq': ['D:husn-khuluq'],
    'mumin-qawi': ['D:ightinam-waqt'],
    'ajz-kasal': ['D:dua'],
    'ilm-la-yanfa': ['D:talab-ilm'],
    'warathat-al-anbiya': ['D:talab-ilm'],
    'fard-as-salat-khamsin': ['D:salah'],
    'qatil-al-mia': ['D:tawba'],
    'dhat-ad-din': ['D:nikah'],
    'al-jalis': ['D:hubb-fillah'],
    'ahabb-al-bilad': ['D:salat-fi-jamaah'],
    'ushr-salatihi': ['D:adab-salah'],
    'awwidu-abna-akum': ['D:nafaqa-ahl'],
    'ibn-abbas-rabbani': ['D:nashr-ilm'],
}

# Athar in his wording (mode as in citations.yaml). Speaker keys from taxonomy/athar-speakers.yaml.
ATHAR = {
    'awwidu-abna-akum': ('ibn-masud', 'عبد الله بن مسعود', 'عوّدوا أبناءكم الخير، فإنّ الخير عادة.', 'lafz'),
    'umar-wasiyya': ('umar', 'عمر بن الخطاب', 'أوصى عمر الخليفةَ من بعده بالمهاجرين والأنصار، وألّا يحمّلهم ما لا يطيقون.', 'maana'),
    'ibn-abbas-rabbani': ('ibn-abbas', 'عبد الله بن عباس', 'الربّاني: الذي يربّي الناس بصغار العلم قبل كباره.', 'lafz'),
}

# He weakened these, or the transcript lost the wording: not loaded.
SKIP = {'muallim-al-khayr', 'bayaa-ala-salatayn', 'mariḍa-aw-safar', 'iqbal-idbar', 'umar-jald-al-fajir'}


def q(url, queries):
    body = json.dumps({'queries': [{'query': s, 'params': p} for s, p in queries]}).encode()
    host = 'api.' + url.split('@', 1)[1].split('/', 1)[0].split('.', 1)[1]
    req = urllib.request.Request(f'https://{host}/sql', data=body, headers={
        'Neon-Connection-String': url, 'Content-Type': 'application/json',
        'Neon-Batch-Isolation-Level': 'Serializable'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def plan():
    data = yaml.safe_load(open(os.path.join(HERE, 'citations.yaml'), encoding='utf-8'))
    rows = []
    for h in data['hadith']:
        if h['key'] in SKIP or not h.get('text_as_said'):
            continue
        mode = 'رواه بمعناه' if h.get('mode') == 'maana' else 'أورده بلفظه'
        ref = '، '.join(x for x in (mode, HIS_SOURCE.get(h['key'])) if x)
        rows.append(dict(key=h['key'], text=h['text_as_said'], isAthar=False, gradeReference=ref))
    for a in data['athar']:
        if a['key'] in SKIP or a['key'] not in ATHAR:
            continue
        speaker, speaker_ar, text, mode = ATHAR[a['key']]
        rows.append(dict(key=a['key'], text=text, isAthar=True, speaker=speaker, speakerAr=speaker_ar,
                         gradeReference='رواه بمعناه' if mode == 'maana' else 'أورده بلفظه'))
    return rows


def main():
    rows = plan()
    links = sum(len(LINKS.get(r['key'], [])) for r in rows)
    print(f'{len(rows)} quotes ({sum(r["isAthar"] for r in rows)} athar), {links} topic links')
    if '--apply' not in sys.argv:
        for r in rows:
            print('-', r['key'], '|', r['gradeReference'], '|', ', '.join(LINKS.get(r['key'], [])) or 'unlinked')
        return
    url = os.environ['NEON_URL']
    found = q(url, [('select id from "Source" where name = $1', [SOURCE_NAME])])['results'][0]['rows']
    source_id = found[0]['id'] if found else str(uuid.uuid4())
    stmts = []
    if not found:
        stmts.append(('insert into "Source"(id, name, "nameAr", type, author, "authorAr", language, "updatedAt") '
                      "values ($1, $2, $3, 'SCHOLAR', $4, $5, 'ar', now())",
                      [source_id, SOURCE_NAME, SOURCE_NAME_AR, 'Anas Sheikh Akrim', 'أنس شيخ اكريم']))
    for r in rows:
        athar = r['isAthar']
        stmts.append((
            'insert into "Quote"(id, type, origin, "textAr", "sourceId", grade, "referenceLabel", "gradeAuthority", '
            '"gradeReference", "gradeSource", "apiProvider", "externalId", "isAthar", "atharSpeakerKey", "atharSpeakerAr", '
            '"atharTextAr", "atharAttributionKind", "atharReviewDecision", "importBatch", "textSource", "updatedAt") '
            "values ($1, 'HADITH', 'LOCAL', $2, $3, $4::\"HadithGrade\", $5, $6, $7, 'MANUAL', $8, $9, $10, $11, $12, $13, "
            "$14::\"AtharAttributionKind\", $15::\"AtharReviewDecision\", $16, 'MANUAL', now()) "
            'on conflict ("apiProvider", "externalId") do nothing',
            [str(uuid.uuid4()), r['text'], source_id, None if athar else 'SAHIH', EPISODE,
             None if athar else AUTHORITY, None if athar else r['gradeReference'], PROVIDER, f'{VIDEO}:{r["key"]}',
             athar, r.get('speaker'), r.get('speakerAr'), r['text'] if athar else None,
             'SAID' if athar else None, 'KEEP' if athar else None, BATCH]))
        for link in LINKS.get(r['key'], []):
            side, slug = link.split(':')
            table, col, topic = ('GoodDeedQuote', 'goodDeedId', 'GoodDeed') if side == 'D' else ('SinQuote', 'sinId', 'Sin')
            stmts.append((
                f'insert into "{table}"(id, "{col}", "quoteId", "relevanceScore", note, "reviewStatus", basis, "classifiedBy", "updatedAt") '
                f"select gen_random_uuid()::text, t.id, q.id, 80, $1, 'ACCEPTED', 'AUTHOR_CITATION', 'REVIEWER', now() "
                f'from "{topic}" t, "Quote" q where t.slug = $2 and q."apiProvider" = $3 and q."externalId" = $4 '
                f'on conflict ("{col}", "quoteId") do nothing',
                [NOTE, slug, PROVIDER, f'{VIDEO}:{r["key"]}']))
    res = q(url, stmts)
    print('statements:', len(res['results']), 'rows written:', sum(x.get('rowCount') or 0 for x in res['results']))


if __name__ == '__main__':
    main()
