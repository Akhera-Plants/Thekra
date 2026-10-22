#!/usr/bin/env python3
"""
Classify HadeethEnc hadith into Thekra taxonomy topics.

Rules:
- Assign only when the topic is the hadith's MAIN subject (not passing mention)
- Up to 2 topics per hadith
- AVOID topics for warning hadith, DO topics for virtue/command hadith
- Leave empty for: creed details, fiqh procedure, sira/history, fitan prophecies, tafsir
- Precision over recall
"""

import csv
import json
import os
import random

CORPUS_DIR = "/Users/moedad/Documents/work/Personal Projects/Thekra/backend/.corpus/hadeethenc"
TSV_IN = "/Users/moedad/Documents/work/Personal Projects/Thekra/docs/taxonomy/hadeethenc-unlinked.tsv"
TSV_OUT = "/Users/moedad/Documents/work/Personal Projects/Thekra/docs/taxonomy/hadeethenc-map.tsv"
NOTES_OUT = "/Users/moedad/Documents/work/Personal Projects/Thekra/docs/taxonomy/hadeethenc-map-notes.md"

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
    "tasweer",  # hidden:true but listed — skip it
}

# Remove hidden topics
HIDDEN_SLUGS = {"jihad", "firar-zahf", "kaffarat", "tasweer"}
ALLOWED_SLUGS -= HIDDEN_SLUGS

# Contemporary topics to exclude
CONTEMPORARY_SLUGS = {
    "waqt-tawasul", "alab-mulhiya", "murahanat", "nazar-shashat",
    "ishaat", "tanammur", "tashhir", "istirad", "ghibah-raqamiya",
    "nashr-khayr-raqami", "silah-raqamiya",
}
ALLOWED_SLUGS -= CONTEMPORARY_SLUGS

def get_corpus(hid):
    """Load Arabic corpus entry if available."""
    fn = os.path.join(CORPUS_DIR, f"one-{hid}-ar.json")
    if os.path.exists(fn):
        return json.load(open(fn))
    return None

def classify(hid, title, categories, grade):
    """
    Returns (topics_list, confidence, reason_str)
    topics_list: list of slug strings (0-2)
    confidence: 'high' or 'low'
    reason: ≤ 12 words
    """
    cat_main = categories.split(' / ')[0]
    # Sub-category numbers as a set
    sub_nums = set()
    if ' / ' in categories:
        parts = categories.split(' / ', 1)[1]
        for p in parts.split('|'):
            sub_nums.add(p.strip())

    # ────────────────────────────────────────────────
    # 1. WHOLE CATEGORY EXCLUSIONS
    # These categories are mostly fiqh/sira/creed details
    # ────────────────────────────────────────────────

    # القرآن الكريم وعلومه — tafsir/sciences of Quran → mostly empty
    # But some clearly about quran recitation → quran topic
    if cat_main == "القرآن الكريم وعلومه":
        # Check for specific sub-content
        t = title
        # Quran tilawa / recitation encouragement
        if any(w in t for w in ["اقرؤوا القرآن", "اقرأ القرآن", "اقرؤا القرآن",
                                  "اقرءوا القرآن", "تلاوة", "يتلو",
                                  "من لم يتغن بالقرآن", "اقرؤوا القرآن"]):
            return ["quran"], "high", "فضل تلاوة القرآن وحثّ عليها"
        if any(w in t for w in ["زينوا القرآن", "بصوت", "صوت حسن"]):
            return ["quran"], "high", "حثّ على تحسين التلاوة"
        if "يذكر الله على كل أحيانه" in t:
            return ["dhikr"], "high", "الذكر على كل حال"
        if "لا تجادلوا في القرآن" in t or "جدالًا فيه كفر" in t:
            return ["jidal"], "high", "نهي عن الجدال في القرآن"
        if any(w in t for w in ["بئس ما لأحدهم أن يقول نسيت",
                                  "نسيان القرآن", "أشد تفصيا"]):
            return ["hajr-quran"], "high", "ذم نسيان القرآن"
        # Shahadah/tawhid in context of Quran citation
        if any(w in t for w in ["لا إله إلا الله", "أحاج لك بها",
                                  "قل لا إله إلا الله"]):
            return ["tawhid"], "high", "الحث على الشهادة والتوحيد"
        # Mostly tafsir / sira context → empty
        return [], "high", "علوم القرآن وتفسير لا موضوع أخلاقي"

    # الحديث وعلومه — mostly methodological
    if cat_main == "الحديث وعلومه":
        if "من كذب علي" in title:
            return ["kadhib"], "high", "تحريم الكذب على النبي"
        if "نضر الله امرأ" in title:
            return ["nashr-ilm"], "high", "فضل نقل العلم"
        return [], "high", "علوم الحديث لا موضوع أخلاقي"

    # السيرة والتاريخ — sira/history context → mostly empty
    if cat_main == "السيرة والتاريخ":
        if "كان النبي صلى الله عليه وسلم أحسن الناس خلقا" in title or \
           "خلق نبي الله" in title:
            return ["husn-khuluq"], "high", "النبي أحسن الناس خلقاً"
        return [], "high", "سيرة وتاريخ لا موضوع أخلاقي مباشر"

    # العقيدة — creed: many are creed details, fitan prophecies, sira
    if cat_main == "العقيدة":
        return _classify_aqida(hid, title, sub_nums)

    # الفقه وأصوله — fiqh procedure: mostly empty, but some clear topics
    if cat_main == "الفقه وأصوله":
        return _classify_fiqh(hid, title, sub_nums)

    # الفضائل والآداب — virtues and etiquette: richest source
    if cat_main == "الفضائل والآداب":
        return _classify_fadail(hid, title, sub_nums)

    # الدعوة والحسبة — calling to good
    if cat_main == "الدعوة والحسبة":
        return _classify_dawah(hid, title, sub_nums)

    return [], "high", "لا موضوع مطابق"


# ─────────────────────────────────────────────────────────
# AQIDA CLASSIFIER
# ─────────────────────────────────────────────────────────
def _classify_aqida(hid, title, sub_nums):
    t = title

    # Shirk / tawhid — only when tawhid is the MAIN subject
    if any(w in t for w in ["يشرك به", "لا يشرك", "أشرك بالله",
                              "من لقي الله لا يشرك",
                              "يشهد أن لا إله إلا الله مستيقنا"]):
        return ["tawhid"], "high", "فضل التوحيد أو ثواب من مات موحداً"
    if any(w in t for w in ["الشرك الأصغر", "الرياء", "يرائي"]):
        return ["riya"], "high", "الرياء شرك أصغر"
    if "من لقي الله لا يشرك" in t:
        return ["tawhid"], "high", "ثواب الموحد عند الله"
    if any(w in t for w in ["الطيرة", "التطير", "ردته الطيرة", "لا يتطير"]):
        return ["tatayyur"], "high", "النهي عن التطير والتشاؤم"
    if any(w in t for w in ["تميمة", "يعلق تميمة", "من علق تميمة",
                              "تعلق", "من تعلق شيئا"]):
        return ["tatayyur"], "high", "النهي عن تعليق التمائم"
    if any(w in t for w in ["السحر", "ساحر", "النشرة", "كتب عمر", "الساحر"]):
        return ["sihr-kahana"], "high", "تحريم السحر والكهانة"
    if any(w in t for w in ["اقتبس علما من النجوم", "المنجم"]):
        return ["sihr-kahana"], "high", "النهي عن تعلم علم النجوم للتنجيم"
    if any(w in t for w in ["الحلف بغير الله", "من حلف بغير الله",
                              "لا تحلفوا بآبائكم", "الحلف بالأمانة",
                              "حلف بالأمانة", "من حلف بالأمانة",
                              "ينهاكم أن تحلفوا بآبائكم",
                              "حلف بملة غير الإسلام"]):
        return ["hilf-bighayr-allah"], "high", "تحريم الحلف بغير الله"
    if "لا تقولوا ما شاء الله وشاء" in t:
        return ["hilf-bighayr-allah"], "high", "نهي عن العطف على الله في القول"
    if "أجعلتني لله عدلا" in t:
        return ["hilf-bighayr-allah"], "high", "نهي عن العطف على الله"
    if any(w in t for w in ["البدع", "محدثات الأمور", "كل بدعة"]):
        return ["bida"], "high", "النهي عن البدع والمحدثات"
    if any(w in t for w in ["سب الصحابة", "يحبهما", "يبغضهما"]):
        if "من أبغضهما" in t:
            return ["sabb-sahaba"], "high", "تحريم بغض الصحابة"
        if "أحبني" in t or "من أحب" in t:
            return ["mahabbat-allah"], "low", "محبة آل بيت النبي"
    if any(w in t for w in ["فاطمة بضعة مني", "أغضبني", "من أحب الحسن"]):
        return ["mahabbat-allah"], "low", "محبة آل بيت النبي"
    if any(w in t for w in ["لتبلغن", "ليبلغن هذا الأمر", "ليبلغن"]):
        return [], "high", "بشارة بانتشار الإسلام"
    if any(w in t for w in ["التوكل", "توكل على الله", "لرزقكم", "يتوكلون",
                              "يا غلام إني أعلمك", "احفظ الله يحفظك"]):
        return ["tawakkul"], "high", "فضل التوكل على الله والتوجه إليه"
    if any(w in t for w in ["القدر", "مقادير", "كتب الله", "القلم"]):
        return [], "high", "مسائل القدر والإيمان عقدية"
    if any(w in t for w in ["الدجال", "يأجوج", "علامات الساعة", "الساعة",
                              "الفتنة", "المهدي"]):
        return [], "high", "أخبار الغيب والفتن والساعة"
    # ── Kaff al-ghadab (before dhikr-akhira check) ──
    if "كظم غيظا" in t or "من كظم غيظا" in t:
        return ["kaff-al-ghadab"], "high", "فضل كظم الغيظ وثوابه"
    # ── Dhikr akhira: only when Hereafter IS the main subject ──
    # Exclude sira details about specific Companions
    if any(w in t for w in ["الجنة", "النار", "القيامة", "الحشر", "الصراط",
                              "الحوض", "الميزان", "البعث", "عذاب"]):
        # Skip fitan/sira hadiths (those are about prediction or companions)
        if any(w in t for w in ["يأجوج", "المهدي", "السفياني", "سيدا كهول",
                                  "سيدا شباب", "رأيتني", "ريحانتاي",
                                  "جعفرا يطير", "الرميصاء",
                                  "مقدار نصف يوم"]):
            return [], "high", "أخبار غيبية أو سيرة"
        return ["dhikr-akhira"], "low", "ذكر الجنة والنار والآخرة"
    if any(w in t for w in ["قاربوا وسددوا", "ارفع رأسك وقل يُسمع",
                              "أيها الناس إياكم والغلو"]):
        return [], "high", "حكمة عامة أو مسألة عقدية"
    if "النشرة" in t:
        return ["sihr-kahana"], "high", "النهي عن النشرة من عمل الشيطان"
    if "لا تجعلوا لله أنداداً" in t or "الأنداد" in t:
        return ["shirk"], "high", "تحريم الشرك واتخاذ الأنداد"
    if any(w in t for w in ["لا تحلفوا بآبائكم", "لا تحلفوا",
                              "لأن أحلف بالله كاذبا",
                              "ينهاكم أن تحلفوا"]):
        return ["hilf-bighayr-allah"], "high", "النهي عن الحلف بغير الله"
    if "اللهم لا تجعل قبري وثنا" in t or "اتخذوا قبور أنبيائهم مساجد" in t:
        return ["shirk"], "high", "النهي عن الغلو في القبور"
    if any(w in t for w in ["إن العهد بيننا الصلاة", "فمن تركها فقد كفر"]):
        return ["tark-as-salah"], "high", "وعيد تارك الصلاة"
    if any(w in t for w in ["الملائكة", "جبريل", "العرش", "الكرسي"]):
        return [], "high", "أخبار عقدية عن الملائكة والغيب"
    if any(w in t for w in ["ترك الصلاة", "العهد الصلاة",
                              "من تركها", "إن العهد الذي بيننا الصلاة"]):
        return ["tark-as-salah"], "high", "وعيد تارك الصلاة"
    if "من ضار ضار الله" in t or "من شاق شق الله" in t:
        return ["adha-muslimin"], "high", "تحريم الضرر والإضرار بالناس"
    if "من تشبه بقوم" in t:
        return ["tashabbuh"], "high", "النهي عن التشبه بغير المسلمين"
    if "خبّب زوجة" in t or "من خبّب" in t:
        return ["nushuz"], "high", "تحريم الإفساد بين الزوجين"
    if "لا يؤمن" in t and "جاره" in t:
        return ["adha-jar"], "high", "تحريم إيذاء الجار"
    if any(w in t for w in ["من اقتنى كلبا", "إطعام", "الرحمة"]):
        return [], "low", "موضوع متنوع"
    if "كل مسكر" in t or "الخمر" in t:
        return ["khamr"], "high", "تحريم المسكرات"
    if "الإيمان ليخلق" in t or "جددوا إيمانكم" in t:
        return [], "high", "أمر بتجديد الإيمان عقدي"
    if "القدر" in t and "كتب" in t:
        return [], "high", "مسائل القدر والإيمان"
    if "الرحم شجنة" in t or "ألا ترضين" in t:
        return ["silat-ar-rahim"], "high", "فضل صلة الرحم"
    if "الله يصنع كل صانع" in t:
        return [], "high", "مسألة عقدية"
    if "إن الله لا ينظر إلى صوركم" in t:
        return ["muraqaba"], "high", "الله ينظر إلى القلوب والأعمال"
    if "من الغيرة ما يحب الله" in t:
        return ["dayyuth"], "low", "الغيرة المحمودة والمذمومة"
    if "أكمل المؤمنين إيمانا أحسنهم خلقا" in t:
        return ["husn-khuluq"], "high", "فضل حسن الخلق وارتباطه بالإيمان"
    if "اللهم لا تجعل قبري وثنا" in t or "لعن الله اليهود" in t:
        return ["shirk"], "high", "النهي عن التبرك بالقبور"
    if "لا تزوج المرأة المرأة" in t:
        return [], "high", "مسألة فقهية في الولاية"
    if "لا يزني الزاني" in t:
        return ["zina"], "high", "نفي الإيمان عن الزاني"
    if "اللهم اجعله هاديا" in t or "اللهم فقّهه" in t:
        return [], "high", "دعاء للصحابة سيرة"
    if "الإيمان يمان" in t:
        return [], "high", "فضل أهل اليمن - سيرة"
    if "في الجنة مائة درجة" in t:
        return [], "high", "أخبار الجنة - غيب"
    if "إذا أراد الله بعبد خيرا" in t or "إذا أراد الله" in t:
        return [], "high", "مشيئة الله - عقدية"
    if "إن الله جعل الحق" in t or "اللهم أحبهما" in t:
        return [], "high", "فضائل صحابة - سيرة"
    if "إن الله محسن يحب الإحسان" in t:
        return ["husn-khuluq"], "high", "الله يحب الإحسان في كل شيء"
    if "ما توطن رجل مسلم المساجد" in t:
        return ["salat-fi-jamaah"], "high", "فضل المداومة على المساجد"
    if "يعجب ربك من راعي غنم" in t:
        return ["salah"], "high", "فضل الأذان والصلاة في الفلوات"
    if "يكشف ربنا عن ساقه" in t:
        return ["riya"], "high", "وعيد من صلى رياءً"
    if "من كظم غيظا" in t:
        return ["kaff-al-ghadab"], "high", "فضل كظم الغيظ"
    if "ولا الله عز وجل لا يلقي حبيبه" in t:
        return [], "high", "مسألة عقدية عن الله"
    if "ليبلغن هذا الأمر" in t:
        return [], "high", "بشارة بانتشار الإسلام"
    # Default for aqida
    return [], "high", "مسألة عقدية أو غيب لا موضوع أخلاقي"


# ─────────────────────────────────────────────────────────
# FIQH CLASSIFIER
# ─────────────────────────────────────────────────────────
def _classify_fiqh(hid, title, sub_nums):
    t = title

    # Riba
    if any(w in t for w in ["الربا", "ربا", "لا ربا إلا في النسيئة"]):
        return ["riba"], "high", "تحريم الربا"
    # Khamr
    if any(w in t for w in ["الخمر", "كل مسكر", "شرب الخمر", "لعنت الخمر",
                              "المسكر"]):
        return ["khamr"], "high", "تحريم الخمر والمسكرات"
    # Zina
    if any(w in t for w in ["زنا", "الزنا", "يزني", "إني زنيت"]):
        return ["zina"], "high", "تحريم الزنا وحكمه"
    if "ملعون من أتى امرأته في دبرها" in t or "لا ينظر الله إلى رجل أتى رجلا" in t:
        return ["liwat"], "high", "تحريم إتيان الدبر"
    if "من وجدتموه يعمل عمل قوم لوط" in t:
        return ["liwat"], "high", "عقوبة اللواط"
    # Sariqa
    if any(w in t for w in ["السرقة", "تقطع اليد", "يسرق", "سارق"]):
        return ["sariqa"], "high", "حكم السرقة وعقوبتها"
    # Rishwa
    if "لعن الله الراشي والمرتشي" in t or "الراشي والمرتشي" in t:
        return ["rishwa"], "high", "تحريم الرشوة"
    # Nazar muharram / khalwa
    if any(w in t for w in ["لا يخلون رجل بامرأة", "لا يخلو رجل",
                              "لا يخلوَنَّ رجل"]):
        return ["nazar-muharram"], "high", "تحريم الخلوة بالأجنبية"
    # Isbal / harir
    if any(w in t for w in ["الحرير", "إنما يلبس الحرير", "هذين حرام",
                              "لا تركبوا الخز"]):
        return ["isbal-harir"], "high", "تحريم الحرير على الرجال"
    # Tanazzuh bawl
    if any(w in t for w in ["استنزهوا من البول", "إصابة البول",
                              "ويل للأعقاب"]):
        return ["tanazzuh-bawl"], "high", "التنزه من البول"
    # Tahara
    if any(w in t for w in ["وضوء", "الوضوء", "اغتسل", "الغسل", "تيمم",
                              "السواك", "الطهور", "طهر", "طهارة", "المد",
                              "النجاسة", "دم", "الحيض", "الجنابة",
                              "الماء طهور", "توضأ", "أسبغ الوضوء",
                              "عشر من الفطرة"]):
        return [], "high", "آداب الطهارة والوضوء فقه"
    # Salah
    if any(w in t for w in ["صلاة", "صلى", "الصلوات الخمس", "الجماعة",
                              "المسجد", "الأذان", "الإقامة", "الركوع",
                              "السجود", "التكبير", "القراءة", "الجمعة",
                              "العيدين", "التشهد", "الوتر", "الضحى",
                              "قيام الليل", "التهجد"]):
        # Salah-specific topics
        if any(w in t for w in ["ترك الصلاة", "تارك الصلاة", "من تركها",
                                  "العهد الصلاة"]):
            return ["tark-as-salah"], "high", "وعيد تارك الصلاة"
        if any(w in t for w in ["من سمع النداء", "من سمع الأذان"]):
            return ["salat-fi-jamaah"], "high", "وجوب إجابة النداء"
        if any(w in t for w in ["إن هاتين الصلاتين أثقل على المنافقين"]):
            return ["salat-fi-jamaah"], "high", "فضل صلاة الجماعة"
        if any(w in t for w in ["يؤمكم أقرؤكم", "يؤم القوم أقرؤهم"]):
            return [], "high", "فقه الإمامة"
        if "من بنى مسجدا" in t or "أمر ببناء المساجد" in t:
            return ["adab-masjid"], "high", "فضل بناء المساجد"
        if "قيام الليل" in t or "التهجد" in t or "صلاة الليل" in t or "الوتر" in t:
            return ["nawafil"], "high", "فضل قيام الليل والنوافل"
        if "صلاة الجمعة" in t or "يوم الجمعة" in t:
            return ["jumua"], "high", "فضل صلاة الجمعة وأحكامها"
        if "الجماعة" in t or "المساجد" in t:
            return ["salat-fi-jamaah"], "low", "أحكام صلاة الجماعة والمساجد"
        return [], "high", "فقه الصلاة وأحكامها"
    # Siyam
    if any(w in t for w in ["صيام", "صوم", "رمضان", "الفطر", "السحور",
                              "الإفطار"]):
        if "أفطر يوما من رمضان" in t or "إفطار" in t and "رمضان" in t:
            return ["iftar-ramadan"], "high", "تحريم الإفطار في رمضان"
        return [], "high", "فقه الصيام وأحكامه"
    # Hajj
    if any(w in t for w in ["الحج", "العمرة", "الإحرام", "الطواف", "السعي",
                              "عرفة", "منى"]):
        return [], "high", "فقه الحج وأحكامه"
    # Zakah
    if any(w in t for w in ["الزكاة", "زكاة الفطر", "صدقة الفطر"]):
        if "منع الزكاة" in t or "مانع" in t:
            return ["man-zakah"], "high", "وعيد مانع الزكاة"
        return [], "high", "فقه الزكاة وأحكامها"
    # Sadaqah related
    if "من تصدق بعدل تمرة" in t or "تصدق" in t:
        return ["sadaqah"], "high", "فضل الصدقة"
    # Nikah/marriage fiqh
    if any(w in t for w in ["النكاح", "الخطبة", "المهر", "الطلاق", "العدة",
                              "الرضاعة", "النفقة", "الخلع"]):
        return [], "high", "فقه النكاح والطلاق"
    # Rishwa / Hadith
    if "اليمين الكاذبة" in t or "يمين آثمة" in t:
        return ["yamin-ghamus"], "high", "تحريم اليمين الكاذبة"
    if "لا تحلفوا" in t or "لا تحلفن" in t:
        return ["hilf-bighayr-allah"], "high", "النهي عن الحلف بالآباء"
    # Mal-related
    if any(w in t for w in ["الغش", "بخس الكيل", "التطفيف", "لا يبع"]):
        return ["ghish"], "high", "تحريم الغش والتطفيف"
    if "من أخذ أموال الناس يريد أداءها" in t:
        return ["amana-wafa"], "high", "أداء الديون والأمانات"
    if "الدين مقضي" in t or "العارية مؤداة" in t:
        return ["amana-wafa"], "high", "وجوب أداء الأمانات والديون"
    if "من احتكر" in t or "الاحتكار" in t:
        return ["ihtikar"], "high", "تحريم الاحتكار"
    if "لا ضرر ولا ضرار" in t:
        return ["zulm"], "high", "تحريم الضرر والإضرار"
    if "قتل" in t and "الدماء" in t:
        return ["qatl"], "high", "تعظيم حرمة الدماء"
    if any(w in t for w in ["قتل النفس", "من قتل مؤمنا"]):
        return ["qatl"], "high", "تعظيم حرمة الدماء"
    if "الراشي والمرتشي" in t:
        return ["rishwa"], "high", "تحريم الرشوة"
    if "من جعل قاضيا" in t:
        return ["zulm-raiyya"], "low", "خطر القضاء وأمانته"
    if "من ولاه الله شيئا" in t or "من استرعاه الله" in t or "يغش رعيته" in t:
        return ["zulm-raiyya"], "high", "خيانة الولاة والمسؤولين"
    if "الإصلاح بين الناس" in t:
        return ["islah-bayn-nas"], "high", "فضل الإصلاح بين الناس"
    if "أن يهدي الله بك" in t:
        return ["nashr-ilm"], "low", "الدعوة إلى الإسلام"
    if "البينة على المدعى" in t or "لو يعطى الناس بدعواهم" in t:
        return [], "high", "فقه القضاء والشهادة"
    if "حبس الغازي" in t or "سبيل الله" in t:
        return [], "high", "فقه الجهاد"
    if "عيادة المريض" in t or "من عاد مريضا" in t:
        return ["iyadat-marid"], "high", "فضل عيادة المريض"
    if "صلى على جنازة" in t or "شهد الجنازة" in t or "تشييع" in t:
        return ["iyadat-marid"], "low", "اتباع الجنائز والصلاة عليها"
    if "من غسل ميتا" in t:
        return [], "high", "أحكام غسل الميت فقه"
    if "أوصيكم بالنساء" in t or "خيركم لنسائهم" in t:
        return ["husn-ishra"], "high", "الوصية بحسن معاملة النساء"
    if "أمة لا يأخذ الضعيف حقه" in t:
        return ["adl"], "high", "وجوب إيصال الحق لأصحابه"
    if "ميت يقوم باكيه فيقول" in t:
        return ["niyaha"], "high", "تحريم النياحة على الميت"
    if "التجار هم الفجار" in t:
        return ["kadhib"], "low", "اقتران التجارة بالكذب والغش"
    if "لا يحل لمسلم" in t and "عيبٌ" in t:
        return ["ghish"], "high", "تحريم كتم عيوب المبيع"
    if "لا يحل لمسلم أن يهجر" in t:
        return ["hijran"], "high", "تحريم هجر المسلم فوق ثلاث"
    if "والله لا يؤمن" in t and "جاره" in t:
        return ["adha-jar"], "high", "تحريم إيذاء الجار"
    if "تهادوا تحابوا" in t:
        return ["husn-khuluq"], "high", "التهادي يزرع المحبة"
    if "أعلنوا النكاح" in t or "خير النكاح أيسره" in t:
        return [], "high", "أحكام إعلان النكاح"
    if "من أطعمه الله طعاما" in t or "أطعموا" in t:
        return ["adab-taam"], "low", "آداب الطعام والشكر"
    if "اللهم بارك لنا" in t:
        return ["adab-taam"], "low", "دعاء الطعام وآدابه"
    # Default for fiqh
    return [], "high", "فقه وأصول لا موضوع أخلاقي مباشر"


# ─────────────────────────────────────────────────────────
# FADAIL CLASSIFIER
# ─────────────────────────────────────────────────────────
def _classify_fadail(hid, title, sub_nums):
    t = title

    # ── Iman / Tawhid ──
    if any(w in t for w in ["التوحيد", "الإيمان بالله"]):
        return ["tawhid"], "high", "فضل التوحيد والإيمان"
    if "إن الله لا يقبل من العمل إلا ما كان خالصا" in t:
        return ["ikhlas"], "high", "وجوب الإخلاص في العمل"
    if "الشرك الخفي" in t or "يصلي فيزين صلاته" in t:
        return ["riya"], "high", "تحذير من الرياء الخفي"

    # ── Tawba / Istighfar ──
    if any(w in t for w in ["اللهم اغفر لي ذنبي", "غفرت لعبدي"]):
        return ["tawba"], "high", "فضل الاستغفار والتوبة"
    if "الندم توبة" in t:
        return ["tawba"], "high", "الندم ركن التوبة"
    if "والذي نفسي بيده لو لم تذنبوا لذهب الله بكم" in t:
        return ["tawba"], "high", "الله يغفر الذنوب لمن استغفر"

    # ── Dhikr ──
    if any(w in t for w in ["لا يزال لسانك رطبا من ذكر الله",
                              "ذكر الله", "الذكر", "التسبيح", "التهليل",
                              "الباقيات الصالحات", "سبحان الله",
                              "لا إله إلا الله وحده", "أفضل الذكر",
                              "أحب الكلام إلى الله", "ما عمل ابن آدم عملا أنجى"]):
        if "التسبيح" in t or "التهليل" in t or "لا إله إلا الله" in t or \
           "سبحان الله" in t or "الذكر" in t or "ذكر الله" in t or \
           "أفضل الذكر" in t or "الباقيات الصالحات" in t:
            return ["dhikr"], "high", "فضل ذكر الله"

    # ── Dua ──
    if any(w in t for w in ["الدعاء", "اللهم إني أسألك", "اللهم إني أعوذ",
                              "ادعوا الله", "دعاء", "لا يرد الدعاء",
                              "من سأل الله", "ربكم يستحيي"]):
        if any(w in t for w in ["الدعاء لا يرد", "الدعاء مخ العبادة",
                                  "لا يرد", "ثنتان لا تردان",
                                  "الدعاء بين الأذان",
                                  "إن ربكم حيي كريم يستحيي"]):
            return ["dua"], "high", "فضل الدعاء وإجابته"
        return ["dua"], "high", "دعاء مأثور أو حث على الدعاء"

    # ── Salat ala nabi ──
    if "الصلاة على النبي" in t or "يصلي عليك" in t or "الصلاة عليك" in t:
        return ["salat-ala-nabi"], "high", "فضل الصلاة على النبي"

    # ── Sabr ──
    if any(w in t for w in ["الصبر", "الصابر", "يصبر", "الصبر الجميل",
                              "ما أصاب المسلم"]):
        return ["sabr"], "high", "فضل الصبر على البلاء"

    # ── Shukr ──
    if "شكر" in t:
        return ["shukr"], "high", "فضل شكر النعمة"

    # ── Zuhd / Tul amal ──
    if any(w in t for w in ["لا يزال قلب الكبير شابا في حب الدنيا",
                              "من كانت الدنيا همه", "الدنيا ملعونة",
                              "ما أنا في الدنيا إلا كراكب",
                              "لو يعلم الناس ما أعلم"]):
        return ["tul-amal"], "high", "ذم حب الدنيا وطول الأمل"
    if any(w in t for w in ["أكثروا ذكر هادم اللذات", "تذكر الموت",
                              "هادم اللذات", "لا تتخذوا الضيعة"]):
        return ["zuhd"], "high", "فضل الزهد وتذكر الموت"

    # ── Tawakkul ──
    if any(w in t for w in ["لو أنكم تتوكلون على الله", "لرزقكم كما يرزق الطير",
                              "احرص على ما ينفعك واستعن بالله"]):
        return ["tawakkul"], "high", "فضل التوكل على الله"

    # ── Khawf raja ──
    if any(w in t for w in ["الخوف من الله", "خوف الله", "يخاف الله",
                              "البكاء من خشية الله", "من خاف أدلج"]):
        return ["khawf-raja"], "high", "فضل الخوف من الله"

    # ── Muraqaba / taqwa ──
    if any(w in t for w in ["اتقوا الله", "التقوى"]):
        return ["muraqaba"], "high", "الحث على التقوى ومراقبة الله"

    # ── Husn khuluq ──
    if any(w in t for w in ["حسن الخلق", "أحسنهم خلقا", "الخلق الحسن",
                              "أحب إلى وأقربكم", "البر حسن الخلق",
                              "أثقل في ميزان المؤمن من خلق حسن",
                              "الله يحب العبد التقي",
                              "أهل الجنة ثلاثة"]):
        return ["husn-khuluq"], "high", "فضل حسن الخلق"
    if "الرفق" in t and "من يحرم الرفق" in t:
        return ["husn-khuluq"], "high", "فضل الرفق وعقوبة من يُحرمه"
    if "من يحرم الرفق" in t:
        return ["husn-khuluq"], "high", "فضل الرفق"

    # ── Haya ──
    if "الحياء من الإيمان" in t:
        return ["haya"], "high", "الحياء شعبة من الإيمان"

    # ── Kaff al-ghadab ──
    if any(w in t for w in ["من كظم غيظا", "كظم الغيظ"]):
        return ["kaff-al-ghadab"], "high", "فضل كظم الغيظ"

    # ── Tawadu ──
    if any(w in t for w in ["وإن الله أوحى إلي أن تواضعوا"]):
        return ["tawadu"], "high", "فضل التواضع"

    # ── Salamat sadr ──
    if any(w in t for w in ["يحب لأخيه ما يحب لنفسه", "سلامة الصدر",
                              "المؤمن مرآة أخيه"]):
        return ["salamat-sadr"], "high", "محبة الخير للناس وسلامة الصدر"

    # ── Sidq ──
    if "الصدق طمأنينة" in t or "دع ما يريبك" in t:
        return ["sidq"], "high", "الصدق والابتعاد عن الريبة"

    # ── Namimah ──
    if any(w in t for w in ["قتّات", "النميمة", "القالة"]):
        return ["namimah"], "high", "تحريم النميمة ووعيد القتات"

    # ── Ghibah ──
    if any(w in t for w in ["الغيبة", "التجسس", "عورات المسلمين",
                              "يتتبع عورات"]):
        if "إنك إن اتبعت عورات" in t:
            return ["tajassus"], "high", "النهي عن تتبع عورات المسلمين"
        return ["ghibah"], "high", "تحريم الغيبة"

    # ── Tajassus ──
    if "إنا قد نهينا عن التجسس" in t:
        return ["tajassus"], "high", "النهي عن التجسس"

    # ── Sabb lan / lagw ──
    if any(w in t for w in ["لا تلاعنوا", "تلاعنوا", "السبّ"]):
        return ["sabb-lan"], "high", "النهي عن اللعن والسب"

    # ── Hijran ──
    if any(w in t for w in ["من هجر أخاه", "لا يحل لمسلم أن يهجر"]):
        return ["hijran"], "high", "تحريم هجر المسلم فوق ثلاث"

    # ── Zulm ──
    if "الظلم ظلمات" in t:
        return ["zulm"], "high", "وعيد الظلم"

    # ── Adha muslimin ──
    if any(w in t for w in ["أذوا المسلمين", "لا تؤذوا المسلمين",
                              "من أذى المسلمين"]):
        return ["adha-muslimin"], "high", "تحريم إيذاء المسلمين"

    # ── Kibr / baghy fakhr ──
    if any(w in t for w in ["الكبر", "تحريم الكبر", "يجر ثوبه", "خيلاء",
                              "الخيلاء"]):
        return ["kibr"], "high", "تحريم الكبر والخيلاء"
    if "يتكلف" in t or "التكلف" in t:
        return ["kibr"], "low", "النهي عن التكلف والمباهاة"

    # ── Silat ar-rahim ──
    if any(w in t for w in ["لا يدخل الجنة قاطع", "قاطع رحم",
                              "تعلموا من أنسابكم ما تصلون به أرحامكم"]):
        return ["qat-al-rahim"], "high", "تحريم قطيعة الرحم"
    if "صلة الرحم" in t or "يصل من وصلها" in t:
        return ["silat-ar-rahim"], "high", "فضل صلة الرحم"

    # ── Birr al-walidayn ──
    if any(w in t for w in ["الوالد أوسط أبواب الجنة",
                              "من أدرك والديه",
                              "رغم أنف رجل أدرك عنده أبواه"]):
        return ["birr-al-walidayn"], "high", "فضل بر الوالدين"
    if "ارجع إليهما فاستأذنهما" in t:
        return ["birr-al-walidayn"], "high", "بر الوالدين مقدم على الجهاد"

    # ── Sadaqah ──
    if any(w in t for w in ["كل معروف صدقة", "الصدقة"]):
        return ["sadaqah"], "high", "فضل الصدقة وكل معروف"

    # ── Kasb halal ──
    if "الكسب الطيب" in t or "طلب الحلال" in t:
        return ["kasb-halal"], "high", "فضل الكسب الحلال"

    # ── Hubb fillah ──
    if any(w in t for w in ["إذا أحب الرجل أخاه فليخبره",
                              "المرء مع من أحب"]):
        return ["hubb-fillah"], "high", "فضل الحب في الله"

    # ── Salam ──
    if any(w in t for w in ["إن أولى الناس بالله من بدأهم بالسلام",
                              "ليسلم الصغير على الكبير",
                              "يجزئ عن الجماعة إذا مروا أن يسلم"]):
        return ["salam"], "high", "فضل إفشاء السلام"

    # ── Talab ilm ──
    if any(w in t for w in ["من خرج في طلب العلم", "من غدا إلى المسجد ليتعلم",
                              "طلب العلم"]):
        return ["talab-ilm"], "high", "فضل طلب العلم"
    if "من سئل عن علم فكتمه" in t or "ألجم بلجام" in t:
        return ["kitman-ilm"], "high", "وعيد من كتم العلم"

    # ── Nashr ilm ──
    if "نضر الله امرأ سمع منا" in t or "نضر الله امرأ" in t:
        return ["nashr-ilm"], "high", "فضل نشر العلم وتبليغه"
    if "من أفتي بغير علم" in t:
        return ["kitman-ilm"], "low", "خطر الإفتاء بغير علم"
    if "لا يقص على الناس إلا أمير" in t:
        return ["kitman-ilm"], "low", "ضبط التعليم والوعظ"

    # ── Ightinam waqt ──
    if any(w in t for w in ["بادروا الأعمال", "خير الناس من طال عمره وحسن عمله",
                              "وفي يده فسيلة فليغرسها"]):
        return ["ightinam-waqt"], "high", "الحث على المبادرة إلى العمل الصالح"

    # ── Adab safar ──
    if any(w in t for w in ["الراكب شيطان", "إذا سافرتم في الخصب",
                              "عليكم بالدلجة",
                              "إذا خرج ثلاثة في سفر",
                              "لو يعلم الناس ما في الوحدة"]):
        return ["adab-safar"], "high", "آداب السفر"

    # ── Adab taam ──
    if any(w in t for w in ["إذا أكل أحدكم فليأكل بيمينه",
                              "لا يشربن أحد منكم قائما",
                              "البركة تنزل وسط الطعام",
                              "ساقي القوم آخرهم شربا",
                              "إذا أكل أحدكم فليذكر اسم الله",
                              "لا آكل وأنا متكئ",
                              "نهى رسول الله عن التنفس في الإناء",
                              "لا يشربن قائما"]):
        return ["adab-taam"], "high", "آداب الأكل والشراب"

    # ── Adab libas ──
    if any(w in t for w in ["البسوا من ثيابكم البياض", "إذا انتعل",
                              "إذا لبستم", "نهى عن الحبوة",
                              "ألبستم ثيابكم",
                              "فليبدأ باليمين", "فليبدأ بالشمال",
                              "من عرض عليه ريحان"]):
        return ["adab-libas"], "high", "آداب اللباس والزينة"

    # ── Adab majlis ──
    if any(w in t for w in ["إذا استأذن أحدكم ثلاثا",
                              "لا يجلس بين رجلين إلا بإذنهما",
                              "إذا حدث الرجل بالحديث ثم التفت",
                              "كان إذا عطس", "إذا عطس"]):
        return ["adab-majlis"], "high", "آداب الاستئذان والمجلس"

    # ── Iyadat marid ──
    if any(w in t for w in ["عيادة المريض", "عاد مريضا"]):
        return ["iyadat-marid"], "high", "فضل عيادة المريض"

    # ── Imatat adha ──
    if any(w in t for w in ["اعزل الأذى عن طريق المسلمين",
                              "إماطة الأذى"]):
        return ["imatat-adha"], "high", "فضل إماطة الأذى"

    # ── Rahma khalq ──
    if any(w in t for w in ["ليس منا من لم يرحم صغيرنا",
                              "ارحموا", "الراحمون يرحمهم الرحمن"]):
        return ["rahma-khalq"], "high", "فضل الرحمة بالخلق"

    # ── Dhikr akhira ──
    if any(w in t for w in ["الجنة", "النار", "القيامة", "الآخرة",
                              "أهل الجنة", "عذاب", "أهون أهل النار",
                              "من يحرم على النار"]):
        return ["dhikr-akhira"], "low", "ذكر الجنة والنار والآخرة"

    # ── Namimah (missed) ──
    if "النميمة القالة" in t or "العضه" in t:
        return ["namimah"], "high", "تحريم النميمة"

    # ── Zulm ──
    if "الظلم ظلمات" in t:
        return ["zulm"], "high", "وعيد الظالمين يوم القيامة"

    # ── Khamr multi (missed) ──
    if any(w in t for w in ["مدمن الخمر", "ثلاثة لا يدخلون الجنة"]):
        return ["khamr", "qat-al-rahim"], "high", "وعيد مدمن الخمر وقاطع الرحم"

    # ── Dua specific (missed) ──
    if any(w in t for w in ["قل هو الله أحد والمعوذتين",
                              "من قال بسم الله الذي لا يضر",
                              "لا تدعوا على أنفسكم"]):
        return ["dua"], "high", "أدعية مأثورة للحفظ والاستعاذة"

    # ── Tawba (missed) ──
    if any(w in t for w in ["من ذا الذي يتألى عليَّ",
                              "يتألى", "لو لم تذنبوا"]):
        return ["tawba"], "high", "سعة رحمة الله ومغفرته للتائبين"

    # ── Tul amal / Fitan ──
    if any(w in t for w in ["يوشك الأمم أن تداعى", "وفتنة أمتي المال"]):
        return ["tul-amal"], "low", "حب الدنيا وفتنة المال"

    # ── Tawakkul (احرص) ──
    if "احرص على ما ينفعك واستعن بالله" in t:
        return ["tawakkul"], "high", "الحث على الاستعانة بالله والتوكل"

    # ── Kibr (اسم ملك الأملاك) ──
    if "أخنع اسم" in t or "ملك الأملاك" in t:
        return ["kibr"], "high", "النهي عن التسمي بأسماء العظمة"

    # ── Muraqaba / sunna (هواه تبعاً) ──
    if "هواه تبعا لما جئت به" in t:
        return ["sunna"], "high", "اتباع السنة وتحكيمها"

    # ── Hilf bighayr (لا تقولوا ما شاء الله وشاء) ──
    if "ما شاء الله وشاء فلان" in t:
        return ["hilf-bighayr-allah"], "high", "النهي عن مشاركة المخلوق مع الله"

    # ── Adab taam (يرقد جنباً - from adab) ──
    if "أيرقد أحدنا وهو جنب" in t:
        return [], "high", "آداب النوم والطهارة فقه"

    # Default
    return [], "high", "فضائل وآداب لا موضوع مطابق محدد"


# ─────────────────────────────────────────────────────────
# DAWAH CLASSIFIER
# ─────────────────────────────────────────────────────────
def _classify_dawah(hid, title, sub_nums):
    t = title

    if any(w in t for w in ["يغش رعيته", "غاش لرعيته", "غش الرعية"]):
        return ["zulm-raiyya"], "high", "وعيد من يغش رعيته"
    if any(w in t for w in ["ستكون أمراء", "خيار أئمتكم", "شرار أئمتكم"]):
        return ["taat-wulat"], "low", "أحكام الولاة والأمراء"
    if "اسمعوا وأطيعوا" in t or "يطع الأمير" in t:
        return ["taat-wulat"], "high", "طاعة ولاة الأمر"
    if "من أهان السلطان" in t:
        return ["taat-wulat"], "high", "حرمة إهانة السلطان"
    if "من أطاعني فقد أطاع الله" in t:
        return ["taat-wulat"], "high", "طاعة النبي وولاة الأمر"
    if "كلمة عدل عند سلطان جائر" in t or "أعظم الجهاد كلمة" in t:
        return ["amr-maruf"], "high", "الأمر بالمعروف عند السلطان الجائر"
    if "لا يمنعن رجلا" in t and "الحق" in t:
        return ["amr-maruf"], "high", "وجوب قول الحق أمام الناس"
    if "المستشار مؤتمن" in t:
        return ["amana-wafa"], "high", "أمانة المستشار"
    if "من ولاه الله" in t and "احتجب" in t:
        return ["zulm-raiyya"], "high", "وعيد من يحتجب عن حوائج الناس"
    if "إنها ستكون أمراء يكذبون" in t:
        return ["zulm-raiyya"], "high", "وعيد من يعين الظالمين"
    if any(w in t for w in ["ما من عبد يسترعيه الله", "من مات وهو غاش"]):
        return ["zulm-raiyya"], "high", "مسؤولية الراعي عن رعيته"

    return [], "high", "دعوة وحسبة لا موضوع أخلاقي مباشر"


# ─────────────────────────────────────────────────────────
# PROCESS ALL ROWS
# ─────────────────────────────────────────────────────────
rows = []
with open(TSV_IN, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for r in reader:
        rows.append(r)

print(f"Processing {len(rows)} hadith...")

results = []
for r in rows:
    hid = r['id']
    title = r['title']
    categories = r['categories']
    grade = r['grade']

    topics, confidence, reason = classify(hid, title, categories, grade)

    # Validate that all topic slugs are allowed
    valid_topics = [s for s in topics if s in ALLOWED_SLUGS]
    if len(valid_topics) < len(topics):
        invalid = [s for s in topics if s not in ALLOWED_SLUGS]
        print(f"WARNING: Invalid slug(s) {invalid} for hadith {hid}")
        topics = valid_topics

    results.append({
        'id': hid,
        'title': title,
        'topics': ','.join(topics),
        'confidence': confidence,
        'reason': reason,
    })

# Write TSV
with open(TSV_OUT, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['id', 'title', 'topics', 'confidence', 'reason'], delimiter='\t')
    writer.writeheader()
    writer.writerows(results)

print(f"Written {len(results)} rows to {TSV_OUT}")

# Quick stats
from collections import Counter
assigned_high = sum(1 for r in results if r['topics'] and r['confidence'] == 'high')
assigned_low = sum(1 for r in results if r['topics'] and r['confidence'] == 'low')
empty = sum(1 for r in results if not r['topics'])
print(f"\nAssigned high: {assigned_high}")
print(f"Assigned low:  {assigned_low}")
print(f"Empty:         {empty}")
print(f"Total:         {len(results)}")

# Topic counts
topic_counter = Counter()
for r in results:
    if r['topics']:
        for s in r['topics'].split(','):
            topic_counter[s.strip()] += 1

print(f"\nTop 30 topics by count:")
for slug, cnt in topic_counter.most_common(30):
    print(f"  {slug}: {cnt}")
PYEOF
