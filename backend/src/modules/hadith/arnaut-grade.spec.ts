import { HadithGrade } from '@prisma/client';
import { arnautArabicGrade, firstClause } from './arnaut-grade.js';

describe('arnautArabicGrade', () => {
  it.each([
    ['إسناده صحيح على شرط الشيخين', HadithGrade.SAHIH],
    ['إسناده صحيح على شرطهما# §', HadithGrade.SAHIH],
    ['إسناده صحيح على شرط مسلم، رجاله ثقات', HadithGrade.SAHIH],
    ['إسناداه صحيحان على شرط الشيخين', HadithGrade.SAHIH],
    ['حديث صحيح، وهذا إسناد ضعيف لضعف علي بن زيد', HadithGrade.SAHIH],
    ['صحيح لغيره وهذا سند رجاله ثقات إلا أن فيه انقطاعا', HadithGrade.SAHIH],
    ['حديث صحيح بطرقه وشواهده', HadithGrade.SAHIH],
    ['إسناده حسن من أجل عاصم بن بهدلة', HadithGrade.HASAN],
    ['حسن لغيره', HadithGrade.HASAN],
    ['حديث حسن', HadithGrade.HASAN],
    ['إسناده صحيح على شرط الشيخين مكرر سندا ومتنا', HadithGrade.SAHIH],
    ['إسناده صحيح على شرط الصحيح', HadithGrade.SAHIH],
    ['إسناده صحيح على شرط الشيخين غير إبراهيم بن بشار الرمادي', HadithGrade.SAHIH],
    ['حديث صحيح إسناده قوي', HadithGrade.SAHIH],
  ])('accepts «%s»', (raw, grade) => {
    expect(arnautArabicGrade(raw)).toBe(grade);
  });

  it.each([
    'إسناده ضعيف لجهالة حال أبي فلان',
    'إسناده صحيح موقوفا',
    'حديث صحيح دون قوله "فلان"',
    'مرفوعه صحيح لغيره',
    'إسناده قوي على شرط مسلم',
    'إسناده جيد',
    'رجاله ثقات رجال الشيخين',
    'إسناده على شرط مسلم',
    'إسناده صحيح إن كان فلان سمعه',
    'حسن مرسل',
    'إسناده صحيح على شرطهما لولا عنعنة الوليد بن مسلم',
    'إسناده صحيح على قلب في اسم أحد رواته',
    'حديث صحيح إسناده ضعيف',
    'هو مكرر ما قبله',
    '',
  ])('refuses «%s»', (raw) => {
    expect(arnautArabicGrade(raw)).toBeNull();
  });

  it('reads only the opening statement, without page markers', () => {
    expect(firstClause('إسناده حسن PageV01P003 ، وأخرجه البخاري')).toBe('إسناده حسن');
  });
});
