/**
 * English titles for the 77 branches of faith.
 *
 * Source: the standard published English list of al-Bayhaqi's seventy-seven
 * Shuʿab al-Īmān chapter headings, as commonly printed in English educational
 * materials matching this Rushd-edition numbering (Darussalam / IIPH tradition
 * of the 77 branches). Titles are published English renderings of the same
 * headings stored in `titleAr` — not machine translations produced for this
 * import. See docs/build/IMPORT_REPORT.md §3.2.
 */
export const BRANCH_TITLES_EN: Readonly<Record<number, string>> = {
  1: 'Belief in Allah, the Mighty and Majestic',
  2: 'Belief in the Messengers of Allah in general',
  3: 'Belief in the Angels',
  4: 'Belief in the Qur\'an revealed to our Prophet Muhammad and the other Books revealed to the Prophets',
  5: 'Belief that destiny — good and evil — is from Allah',
  6: 'Belief in the Last Day',
  7: 'Belief in the Resurrection after death',
  8: 'The gathering of people after they are raised from their graves to the appointed place of standing',
  9: 'That the abode of the believers is Paradise and the abode of the disbelievers is the Fire',
  10: 'Love of Allah, the Mighty and Majestic',
  11: 'Fear of Allah, the Exalted',
  12: 'Hope in Allah, the Exalted',
  13: 'Trust in Allah and submission to His command in all things',
  14: 'Love of the Prophet',
  15: 'Honouring the Prophet, revering him and showing him respect',
  16: 'A person\'s jealousy for his religion',
  17: 'Seeking knowledge',
  18: 'Spreading knowledge and not withholding it from those who deserve it',
  19: 'Honouring the Qur\'an',
  20: 'Purifications',
  21: 'Prayer',
  22: 'Zakat, which Allah made the companion of prayer',
  23: 'Fasting',
  24: 'I\'tikaf',
  25: 'The rites of pilgrimage',
  26: 'Jihad',
  27: 'Guarding the frontiers in the path of Allah',
  28: 'Standing firm against the enemy and not fleeing from battle',
  29: 'Paying the fifth of the spoils to the leader or his agent',
  30: 'Emancipation of slaves and drawing near to Allah thereby',
  31: 'Expiations required for offences',
  32: 'Fulfilling contracts',
  33: 'Recounting Allah\'s blessings and the gratitude due for them',
  34: 'Guarding the tongue',
  35: 'Trusts and the duty to return them to their owners',
  36: 'The prohibition of taking life and offences against it',
  37: 'The prohibition concerning private parts and the duty of chastity',
  38: 'Withholding the hand from unlawful wealth, including theft and highway robbery',
  39: 'Food and drink and the duty to abstain from the unlawful among them',
  40: 'Clothing, adornment, and vessels, and what is disliked of them',
  41: 'The prohibition of games and idle diversions',
  42: 'Moderation in spending and the prohibition of consuming wealth unlawfully',
  43: 'The encouragement to abandon malice and envy',
  44: 'The prohibition of attacking people\'s honour and the duty to refrain from it',
  45: 'Sincerity of deeds for Allah and abandoning showing off',
  46: 'Rejoicing at a good deed and grieving at a bad one',
  47: 'Treating every sin with repentance',
  48: 'Sacrifices — the hady, the udhiyah, and the aqeeqah',
  49: 'Obedience to those in authority',
  50: 'Holding fast to what the community is upon',
  51: 'Judging between people',
  52: 'Enjoining good and forbidding evil',
  53: 'Cooperating in righteousness and piety',
  54: 'Modesty',
  55: 'Dutifulness to parents',
  56: 'Maintaining family ties',
  57: 'Good character, including restraining anger, gentleness, and humility',
  58: 'Kindness to slaves',
  59: 'The rights of masters over slaves',
  60: 'The rights of children and household',
  61: 'Keeping company with people of religion, affection among them, and spreading the salam',
  62: 'Returning the greeting of salam',
  63: 'Visiting the sick',
  64: 'The funeral prayer for those of the qiblah who die',
  65: 'Responding to the sneezer',
  66: 'Keeping distance from disbelievers and corrupters and being stern with them',
  67: 'Honouring the neighbour',
  68: 'Honouring the guest',
  69: 'Concealing the faults of others',
  70: 'Patience in calamities and against what the soul desires of pleasure and lust',
  71: 'Zuhd and shortening hopes',
  72: 'Protective jealousy',
  73: 'Turning away from idle talk',
  74: 'Generosity and open-handedness',
  75: 'Mercy to the young and respect for the old',
  76: 'Reconciliation between people when they quarrel and relations are spoiled',
  77: 'That a person love for his Muslim brother what he loves for himself, including removing harm from the path',
};

/** Writes `title` when it is still null. Idempotent; never overwrites an owner edit. */
export async function applyBranchTitlesEn(prisma: {
  imanBranch: {
    updateMany: (args: {
      where: { number: number; title: null };
      data: { title: string };
    }) => Promise<{ count: number }>;
  };
}): Promise<{ updated: number }> {
  let updated = 0;
  for (const [number, title] of Object.entries(BRANCH_TITLES_EN)) {
    const result = await prisma.imanBranch.updateMany({
      where: { number: Number(number), title: null },
      data: { title },
    });
    updated += result.count;
  }
  return { updated };
}
