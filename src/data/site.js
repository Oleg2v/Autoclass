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
export const mapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(BUSINESS.mapsQuery)}&t=m&z=16&output=embed&hl=iw`;

// Opening hours: filled from the Google Business profile when verified; null = not verified yet.
export const HOURS = null;

// Google Business profile (filled only with verified data).
export const GOOGLE = {
  profileUrl: null,
  rating: null,
  count: null,
  reviews: [],
};
