// Helper for automatic English transliteration and translation of University and College names

const UNIVERSITIES_MAP: Record<string, string> = {
  'القاهرة': 'Cairo University',
  'جامعة القاهرة': 'Cairo University',
  'عين شمس': 'Ain Shams University',
  'جامعة عين شمس': 'Ain Shams University',
  'الاسكندرية': 'Alexandria University',
  'الإسكندرية': 'Alexandria University',
  'جامعة الاسكندرية': 'Alexandria University',
  'جامعة الإسكندرية': 'Alexandria University',
  'المنصورة': 'Mansoura University',
  'جامعة المنصورة': 'Mansoura University',
  'اسيوط': 'Assiut University',
  'أسيوط': 'Assiut University',
  'جامعة اسيوط': 'Assiut University',
  'جامعة أسيوط': 'Assiut University',
  'حلوان': 'Helwan University',
  'جامعة حلوان': 'Helwan University',
  'الزقازيق': 'Zagazig University',
  'جامعة الزقازيق': 'Zagazig University',
  'طنطا': 'Tanta University',
  'جامعة طنطا': 'Tanta University',
  'المنوفية': 'Menofia University',
  'جامعة المنوفية': 'Menofia University',
  'بنها': 'Benha University',
  'جامعة بنها': 'Benha University',
  'كفر الشيخ': 'Kafr El Sheikh University',
  'جامعة كفر الشيخ': 'Kafr El Sheikh University',
  'السويس': 'Suez University',
  'جامعة السويس': 'Suez University',
  'بورسعيد': 'Port Said University',
  'جامعة بورسعيد': 'Port Said University',
  'جنوب الوادي': 'South Valley University',
  'جامعة جنوب الوادي': 'South Valley University',
  'اسوان': 'Aswan University',
  'أسوان': 'Aswan University',
  'جامعة اسوان': 'Aswan University',
  'جامعة أسوان': 'Aswan University',
  'سوهاج': 'Sohag University',
  'جامعة سوهاج': 'Sohag University',
  'بني سويف': 'Beni Suef University',
  'جامعة بني سويف': 'Beni Suef University',
  'الفيوم': 'Fayoum University',
  'جامعة الفيوم': 'Fayoum University',
  'دمياط': 'Damietta University',
  'جامعة دمياط': 'Damietta University',
  'الاقصر': 'Luxor University',
  'الأقصر': 'Luxor University',
  'جامعة الاقصر': 'Luxor University',
  'جامعة الأقصر': 'Luxor University',
  'الجامعة الامريكية': 'American University in Cairo (AUC)',
  'الجامعة الأمريكية': 'American University in Cairo (AUC)',
  'الجامعة الالمانية': 'German University in Cairo (GUC)',
  'الجامعة الألمانية': 'German University in Cairo (GUC)',
  'الجامعة البريطانية': 'British University in Egypt (BUE)',
  'جامعة النيل': 'Nile University',
  'جامعة زويل': 'Zewail City of Science and Technology',
  'جامعة بدر': 'Badr University in Cairo (BUC)',
  'جامعة الجلالة': 'Galala University',
  'جامعة الملك سلمان': 'King Salman International University',
  'جامعة العلمين': 'Alamein International University',
  'جامعة المنصورة الجديدة': 'New Mansoura University',
  'جامعة مصر للعلوم والتكنولوجيا': 'Misr University for Science and Technology (MUST)',
  'جامعة 6 اكتوبر': 'October 6 University',
  'جامعة 6 أكتوبر': 'October 6 University',
  'جامعة المستقبل': 'Future University in Egypt (FUE)',
  'جامعة فاروس': 'Pharos University in Alexandria (PUA)',
  'جامعة النهضة': 'Nahda University (NUB)',
  'جامعة الدلتا': 'Delta University for Science and Technology',
  'جامعة هليوبوليس': 'Heliopolis University',
  'جامعة سيناء': 'Sinai University',
  'جامعة الاهرام الكندية': 'Ahram Canadian University (ACU)',
  'جامعة الأهرام الكندية': 'Ahram Canadian University (ACU)',
  'جامعة مصر الدولية': 'Misr International University (MIU)',
  'الجامعة المصرية اليابانية': 'Egypt-Japan University of Science and Technology (E-JUST)',
  'جامعة بنها الاهلية': 'Benha National University',
  'جامعة بنها الأهلية': 'Benha National University',
  'جامعة حلوان الاهلية': 'Helwan National University',
  'جامعة حلوان الأهلية': 'Helwan National University',
  'جامعة الاسكندرية الاهلية': 'Alexandria National University',
  'جامعة الإسكندرية الأهلية': 'Alexandria National University',
  'جامعة المنصورة الاهلية': 'Mansoura National University',
  'جامعة المنصورة الأهلية': 'Mansoura National University',
  'جامعة اسيوط الاهلية': 'Assiut National University',
  'جامعة أسيوط الأهلية': 'Assiut National University'
};

const COLLEGES_MAP: Record<string, string> = {
  'الحاسبات والذكاء الاصطناعي': 'Faculty of Computers and Artificial Intelligence',
  'كلية الحاسبات والذكاء الاصطناعي': 'Faculty of Computers and Artificial Intelligence',
  'حاسبات وذكاء اصطناعي': 'Faculty of Computers and Artificial Intelligence',
  'الحاسبات والمعلومات': 'Faculty of Computers and Information',
  'كلية الحاسبات والمعلومات': 'Faculty of Computers and Information',
  'حاسبات ومعلومات': 'Faculty of Computers and Information',
  'علوم الحاسب': 'Faculty of Computer Science',
  'كلية علوم الحاسب': 'Faculty of Computer Science',
  'الهندسة': 'Faculty of Engineering',
  'كلية الهندسة': 'Faculty of Engineering',
  'هندسة': 'Faculty of Engineering',
  'الطب البشري': 'Faculty of Medicine',
  'كلية الطب البشري': 'Faculty of Medicine',
  'الطب': 'Faculty of Medicine',
  'كلية الطب': 'Faculty of Medicine',
  'طب': 'Faculty of Medicine',
  'طب الاسنان': 'Faculty of Dentistry',
  'طب الأسنان': 'Faculty of Dentistry',
  'كلية طب الاسنان': 'Faculty of Dentistry',
  'كلية طب الأسنان': 'Faculty of Dentistry',
  'الصيدلة': 'Faculty of Pharmacy',
  'كلية الصيدلة': 'Faculty of Pharmacy',
  'صيدلة': 'Faculty of Pharmacy',
  'العلاج الطبيعي': 'Faculty of Physical Therapy',
  'كلية العلاج الطبيعي': 'Faculty of Physical Therapy',
  'علاج طبيعي': 'Faculty of Physical Therapy',
  'التمريض': 'Faculty of Nursing',
  'كلية التمريض': 'Faculty of Nursing',
  'تمريض': 'Faculty of Nursing',
  'العلوم': 'Faculty of Science',
  'كلية العلوم': 'Faculty of Science',
  'علوم': 'Faculty of Science',
  'التجارة': 'Faculty of Commerce',
  'كلية التجارة': 'Faculty of Commerce',
  'تجارة': 'Faculty of Commerce',
  'ادارة الاعمال': 'Faculty of Business Administration',
  'إدارة الأعمال': 'Faculty of Business Administration',
  'كلية ادارة الاعمال': 'Faculty of Business Administration',
  'كلية إدارة الأعمال': 'Faculty of Business Administration',
  'الاقتصاد والعلوم السياسية': 'Faculty of Economics and Political Science',
  'كلية الاقتصاد والعلوم السياسية': 'Faculty of Economics and Political Science',
  'الاعلام': 'Faculty of Mass Communication',
  'الإعلام': 'Faculty of Mass Communication',
  'كلية الاعلام': 'Faculty of Mass Communication',
  'كلية الإعلام': 'Faculty of Mass Communication',
  'الالسن': 'Faculty of Al-Alsun',
  'الألسن': 'Faculty of Al-Alsun',
  'كلية الالسن': 'Faculty of Al-Alsun',
  'كلية الألسن': 'Faculty of Al-Alsun',
  'اللغات والترجمة': 'Faculty of Languages and Translation',
  'كلية اللغات والترجمة': 'Faculty of Languages and Translation',
  'الاداب': 'Faculty of Arts',
  'الآداب': 'Faculty of Arts',
  'كلية الاداب': 'Faculty of Arts',
  'كلية الآداب': 'Faculty of Arts',
  'الحقوق': 'Faculty of Law',
  'كلية الحقوق': 'Faculty of Law',
  'حقوق': 'Faculty of Law',
  'التربية': 'Faculty of Education',
  'كلية التربية': 'Faculty of Education',
  'الزراعة': 'Faculty of Agriculture',
  'كلية الزراعة': 'Faculty of Agriculture',
  'الفنون الجميلة': 'Faculty of Fine Arts',
  'كلية الفنون الجميلة': 'Faculty of Fine Arts',
  'الفنون التطبيقية': 'Faculty of Applied Arts',
  'كلية الفنون التطبيقية': 'Faculty of Applied Arts',
  'الاثار': 'Faculty of Archaeology',
  'الآثار': 'Faculty of Archaeology',
  'كلية الاثار': 'Faculty of Archaeology',
  'كلية الآثار': 'Faculty of Archaeology',
  'السياحة والفنادق': 'Faculty of Tourism and Hotels',
  'كلية السياحة والفنادق': 'Faculty of Tourism and Hotels',
  'تكنولوجيا المعلومات': 'Faculty of Information Technology',
  'كلية تكنولوجيا المعلومات': 'Faculty of Information Technology',
  'الذكاء الاصطناعي': 'Faculty of Artificial Intelligence',
  'كلية الذكاء الاصطناعي': 'Faculty of Artificial Intelligence',
  'العلوم الصحية': 'Faculty of Applied Health Sciences',
  'كلية العلوم الصحية': 'Faculty of Applied Health Sciences',
  'التربية الرياضية': 'Faculty of Physical Education',
  'كلية التربية الرياضية': 'Faculty of Physical Education',
  'التربية النوعية': 'Faculty of Specific Education',
  'كلية التربية النوعية': 'Faculty of Specific Education'
};

const ARABIC_TO_LATIN: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'aa', 'ء': "'", 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'g', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ى': 'a', 'ئ': 'e', 'ؤ': 'o', 'ة': 'a', ' ': ' '
};

function transliterateArabic(text: string): string {
  return text
    .split('')
    .map(char => ARABIC_TO_LATIN[char] || char)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function autoTranslateUniversity(text: string): string {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  
  if (UNIVERSITIES_MAP[clean]) return UNIVERSITIES_MAP[clean];
  
  // Try substring matching for known universities
  for (const [arKey, enVal] of Object.entries(UNIVERSITIES_MAP)) {
    if (clean.includes(arKey)) {
      return enVal;
    }
  }

  // Fallback with prefix translation
  if (clean.startsWith('جامعة ')) {
    const remainder = clean.replace('جامعة ', '');
    return `${transliterateArabic(remainder)} University`;
  }

  return `${transliterateArabic(clean)} University`;
}

export function autoTranslateCollege(text: string): string {
  if (!text || !text.trim()) return '';
  const clean = text.trim();
  
  if (COLLEGES_MAP[clean]) return COLLEGES_MAP[clean];
  
  for (const [arKey, enVal] of Object.entries(COLLEGES_MAP)) {
    if (clean.includes(arKey)) {
      return enVal;
    }
  }

  // Fallback with prefix translation
  if (clean.startsWith('كلية ')) {
    const remainder = clean.replace('كلية ', '');
    return `Faculty of ${transliterateArabic(remainder)}`;
  } else if (clean.startsWith('معهد ')) {
    const remainder = clean.replace('معهد ', '');
    return `Institute of ${transliterateArabic(remainder)}`;
  }

  return `Faculty of ${transliterateArabic(clean)}`;
}
