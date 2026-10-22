import type { PrismaClient } from '@prisma/client';

/**
 * The fifty Sahih al-Targhib OCR rows the owner revealed by name.
 * Importers must never stamp textVerifiedAt. Only an admin action (or this
 * allow-list, when clearing accidental stamps) may keep a verified OCR row.
 */
export const OWNER_REVEALED_TARGHIB_IDS = [
  '2226df69-6233-400d-b66a-bcd3c295acf0',
  '255dafa2-1074-4d6b-8113-1d8d82ae3235',
  '2777381b-0ce6-4e64-9a9d-1d779ddccad3',
  '29867829-d73e-4e1a-91f7-810ff57d1dbf',
  '39f56ff6-2439-416c-85c8-7f8be0903b62',
  '45d1dcbe-8e49-4978-9596-7f6368823c4e',
  '565c0015-9dc0-46dc-a530-3eec297998a1',
  '585a48e9-7902-44df-be51-5c186141c321',
  '5c2749f7-d985-41df-b7e3-6ce6c42b3782',
  '5d79e9ac-5255-4a37-82a9-d41fc48ebb64',
  '65492a81-d5c9-428a-b726-b9fa273ef84f',
  '69c6dc12-522b-4c27-a36b-59e7a2ac1191',
  '712e23e7-e1ea-47a9-8261-ceb2d1a6aa79',
  '74b167fd-8342-4262-b859-d6815e4ea735',
  '76402dad-e354-42a5-9446-55febbac8938',
  '7a971a14-bb26-47de-8bb9-d44f85bd7fbc',
  '7b1f17b7-6315-45d7-bf1d-e525fa712405',
  '803e089a-b583-485b-b4d8-07976edd68a8',
  '86440300-d36f-483c-8457-a27b70038c2a',
  '8b356369-7507-4332-b0b0-d523491972d2',
  '8f42ffc4-3396-4790-af02-3a454821c57f',
  '8f4d171f-5345-46b0-a79c-c0f866989db1',
  '8f59d3ff-5745-4e74-a091-e67372a9acd3',
  '999e22bd-bd8a-4dfa-9fda-989b973e72f6',
  '9d34da73-6139-43af-a8d9-f37e7f8ad536',
  '9fd6781c-e1ed-46a9-a419-51149f4026e3',
  'a50df039-58c7-4bd1-acdf-e40dcf2e5097',
  'a8108088-3a37-4588-bef8-7b307447f42b',
  'a99ad5d4-6f45-4697-b4ad-9819f4148df4',
  'ab166515-9661-4a03-963b-8d2ad27c8aae',
  'ab2fcf27-ae36-40f3-bc33-f481593f828f',
  'bb1afb75-d588-4f82-9dce-a8b5e36bfe8d',
  'c061854e-2fe3-45ad-9405-33447519dd50',
  'c0dd5625-9f67-4af6-8731-4175826d3ab5',
  'c27002aa-1630-4b8b-a33c-84e2412fe47f',
  'c3bc46f1-5de9-4601-8d37-c82139bf03fa',
  'c5639f7c-0537-497b-bc59-71444e68a257',
  'c802d33c-27fd-4937-8042-f0bc8c549f4a',
  'c91a9892-ae98-47ae-89ff-eb05260ade9d',
  'c9efad46-2015-47c1-aa75-477b7bcee1f7',
  'd28f061b-7cff-4c85-bf1a-d384ab3357eb',
  'd90d68c0-b6ce-4785-996d-249394530a4d',
  'dcb3c793-48c4-48ed-a13b-57b6e122d677',
  'df7c79f9-628a-4809-b242-92be4e1dd432',
  'e7f657b2-b1db-49ca-936b-1ef613759a9f',
  'ecae10f7-9243-48be-95ba-46ffbe6a3061',
  'f5fea5e5-98d0-4726-8370-9e0737c878b2',
  'f78bc4d4-a21a-4f25-8285-bf6e15a50e2c',
  'fc10a5f6-c225-4bfe-9602-8919364c28ba',
  'fed286e3-d00d-4051-8631-c468edb37ec3',
] as const;

/** Clear OCR verification stamps that are not on the owner's allow-list. */
export async function clearUnapprovedOcrVerification(prisma: PrismaClient): Promise<number> {
  const result = await prisma.quote.updateMany({
    where: {
      textSource: 'OCR',
      textVerifiedAt: { not: null },
      id: { notIn: [...OWNER_REVEALED_TARGHIB_IDS] },
    },
    data: { textVerifiedAt: null },
  });
  return result.count;
}
