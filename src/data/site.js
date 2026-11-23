// Single source of truth for business facts.
// Everything here comes from autoclassltd.com unless marked otherwise (see README → "Owner to confirm").

export const SITE_URL = 'https://autoclass.kikkey.com';

export const BUSINESS = {
  nameHe: 'אוטו קלאס – מרכז שירות לרכב',
  shortHe: 'אוטו קלאס',
  nameEn: 'Auto Class',
  founded: 1960,
  // TEMPORARY single number (owner must confirm). The old site shows 5 different numbers.
  phoneDisplay: '052-5634040',
  phoneTel: '+972525634040',
  whatsapp: '972525634040',
  email: 'sm@autoclassltd.com',
  street: 'הסולל 3',
  area: 'אזור התעשייה',
  city: 'חולון',
  cityEn: 'Holon',
  country: 'IL',
  mapsQuery: 'הסולל 3 חולון',
};

export const WHATSAPP_TEXT = 'שלום אוטו קלאס, הרכב שלי נפגע ואני רוצה לשלוח לכם תמונות של הנזק.';

export const waLink = (text = WHATSAPP_TEXT) =>
  `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
export const telLink = `tel:${BUSINESS.phoneTel}`;
export const mailLink = `mailto:${BUSINESS.email}`;
export const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.mapsQuery)}`;
export const wazeLink = `https://waze.com/ul?q=${encodeURIComponent(BUSINESS.mapsQuery)}&navigate=yes`;
export const mapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent('מוסך אוטו קלאס חולון, הסולל 3')}&t=m&z=16&output=embed&hl=iw`;

// Opening hours as shown on the Google Business profile "מוסך אוטו קלאס חולון" (checked 23.11.2026).
// The old site lists no hours. Owner to confirm (README).
export const HOURS = [
  { days: ['sun', 'mon', 'tue', 'wed', 'thu'], opens: '08:00', closes: '17:00', key: 'week', text: '08:00–17:00' },
  { days: ['fri', 'sat'], opens: null, closes: null, key: 'weekend', text: null },
];

// Google Business profile — only data that was actually displayed there (checked 23.11.2026).
// Reviews are verbatim (author's own spelling kept), chosen among 68 loaded reviews.
export const GOOGLE = {
  name: 'מוסך אוטו קלאס חולון',
  profileUrl: 'https://maps.google.com/?cid=12718303962682839334',
  rating: '4.9',
  count: '164',
  checked: '2026-11-23',
  reviews: [
  {
    "author": "כרמל ליברמן",
    "stars": 5,
    "text": "ממליצה מאוד! הגעתי אחרי תאונה. הצוות טיפל במסירות מהרגע הראשון, אפילו טיפלו בכל עיניין התביעה של הביטוח וקיבלתי רכב חליפי במקום. ממש לא הייתי צריכה להתעסק בכלום. ותוך כמה ימים חזר אלי הרכב שלי כמו חדש!! ממליצה מאוד!!"
  },
  {
    "author": "Izik Gur",
    "stars": 5,
    "text": "מאוד מרוצה מאוטו קלאס חולון , עבודת פחחות וצבע מצויינים , קבלת רכב חלופי , ליווי יעיל ומסור מול חברת הביטוח של הפוגע , עד לקבלת הכסף . ממליץ בחום .\nתודה לשי סימה ודליה\nאיציק בעלים של טסלה"
  },
  {
    "author": "Nati Yachimovitz",
    "stars": 5,
    "text": "שרות מעולה. אמין ומקצועי ביותר.\nתודה לשי ובאיחוד לניקולה המקצוען, על הביצוע המושלם בתיקוני הפחחות ובעיקר התאמת הצבע המדויקת.\nתודה"
  },
  {
    "author": "shaniki dot",
    "stars": 5,
    "text": "מוסך מדהים. החזירו לי רכב כחדש, פלוס שטיפה בתוך ימים בודדים, בהם דאגו לי לרכב חלופי, והכל בחיוך ובאהבה.\nממליצה בחום"
  },
  {
    "author": "מני כרמונה",
    "stars": 4,
    "text": "הגעתי מאוכזב מהמכה ויצאתי מבסוט מהתיקון\nהרגשתי שקיבלתי שוב רכב מסוכנות כמו שקניתי"
  },
  {
    "author": "בוריס יגודייב",
    "stars": 5,
    "text": "תיקנתי בעבר במוסך זה.\nהבאתי את הרכב למוסך קיבלתי רכב חלופי במקום.\nדאגו לי לכל הטפסים והטיפול בתביעה.\nהפחחות והצבע יצא מושלם והכל לשביעות רצוני.\nמוסך ברמה גבוהה והשירות מעולה.\nתודה לכם"
  }
],
};
