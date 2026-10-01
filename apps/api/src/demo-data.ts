export const DEMO_DATA_VERSION = 'phase6-refinement-v1';
const agencies = [
  [
    'Deccan Crescent Travel Network',
    'deccan-crescent',
    'Hyderabad',
    'Pilgrimage and family groups',
  ],
  [
    'Hyderabad Royal Journey Services',
    'hyderabad-royal',
    'Hyderabad',
    'Luxury and corporate travel',
  ],
  [
    'Crescent Gate Pilgrimage Solutions',
    'crescent-gate',
    'Secunderabad',
    'Pilgrimage operations',
  ],
  [
    'Meridian Global Travel Partners',
    'meridian-global',
    'Mumbai',
    'International holidays',
  ],
  [
    'Arabian Horizon Destination Services',
    'arabian-horizon',
    'Dubai',
    'Gulf destination services',
  ],
  [
    'Pearl Route Travel & Tourism',
    'pearl-route',
    'Kochi',
    'Leisure and beach travel',
  ],
  [
    'Safa International Travel Network',
    'safa-international',
    'Bengaluru',
    'Group and educational travel',
  ],
  [
    'Blue Horizon Visa & Holidays',
    'blue-horizon',
    'Chennai',
    'Visa support and holidays',
  ],
  [
    'Gateway Arabia Ground Services',
    'gateway-arabia',
    'Jeddah',
    'Ground transport and logistics',
  ],
  [
    'Heritage World Travel Solutions',
    'heritage-world',
    'Delhi',
    'Heritage and cultural tours',
  ],
] as const;
export const demoAgencies = agencies.map(
  ([name, slug, city, specialization], i) => ({
    number: i + 1,
    name: `${name} (Fictional Demo)`,
    slug: `phase6-demo-${slug}`,
    city,
    specialization,
    email: `owner${String(i + 1).padStart(2, '0')}@phase6-demo.invalid`,
    phone: `+91987654${String(1000 + i)}`,
    market: i === 4 || i === 8 ? 'UAE' : 'India',
    country: i === 4 ? 'UAE' : i === 8 ? 'Saudi Arabia' : 'India',
  }),
);
export const demoAdmins = [
  { name: 'Phase 6 Demo Admin One', email: 'admin01@phase6-demo.invalid' },
  { name: 'Phase 6 Demo Admin Two', email: 'admin02@phase6-demo.invalid' },
] as const;
export const listingFamilies = {
  pilgrimage: [
    'Economy Umrah',
    'Premium Umrah',
    'Family Umrah',
    'Ramadan Group Umrah',
    'Private Pilgrimage',
  ],
  tourism: [
    'Heritage Circuit',
    'Family Holiday',
    'Adventure Escape',
    'Luxury Retreat',
    'Cultural Discovery',
  ],
  visa: [
    'Tourist Visa Assistance',
    'Business Visa Assistance',
    'Family Visit Documentation',
    'Student Document Review',
    'Conference Visa Support',
  ],
  ground: [
    'Airport Transfer',
    'Private Chauffeur',
    'Intercity Transfer',
    'Group Coach',
    'Meet And Greet',
  ],
} as const;
export function stableUuid(kind: number, agency: number, item = 0) {
  return `60000000-0000-${String(kind).padStart(4, '0')}-${String(agency).padStart(4, '0')}-${String(item).padStart(12, '0')}`;
}
