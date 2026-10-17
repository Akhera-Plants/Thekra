export interface RajabBook {
  key: string;
  id: string;
  name: string;
  nameAr: string;
  file: string;
  sha256: string;
}

/** Digitized editions already saved under backend/.corpus/ibn-rajab. The hash stops a silent file change. */
export const RAJAB_BOOKS: readonly RajabBook[] = [
  {
    key: 'khamr',
    id: '10000000-0000-4000-8000-000000000016',
    name: 'Dhamm al-Khamr',
    nameAr: 'ذم الخمر',
    file: 'khamr.txt',
    sha256: 'af337092606ecb4e446c53b925ae2952b00aebc97708a284e40d9610d1a79a60',
  },
  {
    key: 'yatba',
    id: '10000000-0000-4000-8000-000000000017',
    name: 'The Three that Follow the Dead',
    nameAr: 'شرح حديث يتبع الميت ثلاثة',
    file: 'yatba.txt',
    sha256: '0393edd1184a56ebd9b6574f77d5763ac847f453f53d840a821900ba80176c65',
  },
  {
    key: 'istinshaq',
    id: '10000000-0000-4000-8000-000000000018',
    name: 'Istinshaq Nasim al-Uns',
    nameAr: 'استنشاق نسيم الأنس',
    file: 'istinshaq.txt',
    sha256: 'e8b7562545c0feaf41ccc2b860c888c2493cdfbb3639f005fe80c19310cc9fb1',
  },
  {
    key: 'mahajja',
    id: '10000000-0000-4000-8000-000000000019',
    name: 'Al-Mahajjah fi Sayr al-Duljah',
    nameAr: 'المحجة في سير الدلجة',
    file: 'mahajja.txt',
    sha256: '5ead4a301e571e17a8c5495c48115ddecadbe6480118c18afec6ff0e697cd135',
  },
  {
    key: 'ikhtiyar',
    id: '10000000-0000-4000-8000-000000000020',
    name: 'Ikhtiyar al-Ula',
    nameAr: 'اختيار الأولى',
    file: 'ikhtiyar.txt',
    sha256: 'bbdc20eb95cdf6a6c9de4d9e22f9fd8bb5c2f3438edb72ac761c05e0ea6285b2',
  },
  {
    key: 'takhweef',
    id: '10000000-0000-4000-8000-000000000021',
    name: 'Al-Takhweef min al-Nar',
    nameAr: 'التخويف من النار',
    file: 'takhweef.txt',
    sha256: 'c2a553c4f870471f8dc5699ec93e1831aac35efbbfc66e4b0c5fc05ee07b966b',
  },
  {
    key: 'qubur',
    id: '10000000-0000-4000-8000-000000000022',
    name: 'Ahwal al-Qubur',
    nameAr: 'أهوال القبور',
    file: 'qubur.txt',
    sha256: '96ba32257915a1ca2846303dc6466d868281b82485c80f1ce9530278025f58fa',
  },
  {
    key: 'lataif',
    id: '10000000-0000-4000-8000-000000000023',
    name: "Lata'if al-Ma'arif",
    nameAr: 'لطائف المعارف',
    file: 'lataif.txt',
    sha256: '2b471170acdbac5c4f901a038c5822ac9ea72de51377155eda02ea4e63425ab4',
  },
];
