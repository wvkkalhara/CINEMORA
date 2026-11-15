// Single source of truth for every indexable URL on the site.
// The Worker uses this to set per-page <title>, description, canonical,
// Open Graph tags, the visible section, the page's <h1>, and the sitemap.
// To add a page: add a <section id="..."> to public/index.html and an entry here.

export const SITE = {
  name: 'Cinemora Production',
  origin: 'https://cinemoraproduction.com',
};

export const ROUTES = {
  home: {
    path: '/',
    title: 'Cinemora Production | Wedding Cinematography & Videography in Sri Lanka',
    description:
      'Cinemora Production is a videography and film production company in Balapitiya, Sri Lanka. Cinematic wedding films, commercial and corporate videos, product shoots and music videos. Packages from Rs. 8,000.',
    priority: '1.0',
    changefreq: 'monthly',
    crumb: 'Home',
  },
  prices: {
    path: '/prices',
    title: 'Wedding Videography Packages & Prices in Sri Lanka | Cinemora Production',
    description:
      'Videography and photography prices in LKR: wedding films from Rs. 55,000, events from Rs. 25,000, commercials from Rs. 40,000, product shoots from Rs. 20,000 and music videos from Rs. 65,000. Request a quotation.',
    priority: '0.9',
    changefreq: 'monthly',
    crumb: 'Pricing & Packages',
  },
  contact: {
    path: '/contact',
    title: 'Book a Videographer in Balapitiya, Sri Lanka | Contact Cinemora Production',
    description:
      'Call 070 377 0730 or 074 350 0507, WhatsApp or email Cinemora Production to book wedding cinematography, event coverage or commercial video production in Sri Lanka.',
    priority: '0.8',
    changefreq: 'yearly',
    crumb: 'Contact',
  },
  location: {
    path: '/location',
    title: 'Videographer in Balapitiya, Sri Lanka | Cinemora Production Location',
    description:
      'Cinemora Production is based in Pathegama, Balapitiya, near Ahungalla Police Station, and films weddings, events and commercials across Sri Lanka. Call or message before visiting.',
    priority: '0.8',
    changefreq: 'yearly',
    crumb: 'Location',
  },
  founder: {
    path: '/founder',
    title: 'Meet the Founder, Thusal De Silva | Cinemora Production',
    description:
      'Meet W. Thusal Prabhasha Methshan De Silva, the filmmaker from Balapitiya who founded Cinemora Production to turn special moments into timeless cinematic stories.',
    priority: '0.6',
    changefreq: 'yearly',
    crumb: 'Meet the Founder',
  },
  social: {
    path: '/social',
    title: 'Instagram, Facebook & TikTok | Cinemora Production',
    description:
      'Follow Cinemora Production on Instagram, Facebook and TikTok for our latest wedding films, cinematic reels and behind-the-scenes from shoots across Sri Lanka.',
    priority: '0.5',
    changefreq: 'monthly',
    crumb: 'Social Media',
  },
};

export const PATH_TO_ROUTE = Object.fromEntries(
  Object.entries(ROUTES).map(([key, r]) => [r.path, key]),
);
