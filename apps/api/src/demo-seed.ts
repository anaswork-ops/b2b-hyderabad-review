import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  DEMO_DATA_VERSION,
  demoAdmins,
  demoAgencies,
  listingFamilies,
  stableUuid,
} from './demo-data.js';

const url = process.env.DEMO_DATABASE_URL;
if (!url) throw new Error('DEMO_DATABASE_URL is required');
const databaseName = new URL(url).pathname.slice(1);
if (!/^b2btravelv2_phase6_demo(?:_[a-z0-9]+)?$/i.test(databaseName))
  throw new Error(
    'Target must be a dedicated b2btravelv2_phase6_demo database',
  );
if (process.env.DEMO_PROVISION_CONFIRM !== databaseName)
  throw new Error(
    `Set DEMO_PROVISION_CONFIRM=${databaseName} to confirm this exact target`,
  );
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
if (
  await db.business.count({
    where: {
      primaryOwner: { email: { not: { endsWith: '@phase6-demo.invalid' } } },
    },
  })
)
  throw new Error('Refusing a database containing non-demo businesses');

const privateDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../demo-private',
);
const handoverPath = resolve(privateDir, 'PHASE_6_DEMO_ACCOUNT_HANDOVER.md');
await mkdir(privateDir, { recursive: true });
let existingHandover = false;
try {
  await readFile(handoverPath);
  existingHandover = true;
} catch {
  /* first run */
}
const rows: string[] = [];
const password = () => `${randomBytes(15).toString('base64url')}!aA7`;
async function ensureUser(input: {
  id: string;
  email: string;
  mobile?: string;
  role: 'BUSINESS_USER' | 'ADMIN';
  label: string;
  business: string;
  destination: string;
}) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    rows.push(
      `| ${input.label} | ${input.role} | ${input.email} | Preserved; use recovery if unavailable | ${input.business} | ${input.destination} | ${input.role === 'ADMIN' ? 'MFA mandatory' : 'Verified owner'} |`,
    );
    return existing;
  }
  const initialPassword = password();
  const user = await db.user.create({
    data: {
      id: input.id,
      email: input.email,
      mobile: input.mobile,
      role: input.role,
      passwordHash: await argon2.hash(initialPassword, {
        type: argon2.argon2id,
      }),
      emailVerifiedAt: new Date(),
      mobileVerifiedAt: input.mobile ? new Date() : null,
    },
  });
  rows.push(
    `| ${input.label} | ${input.role} | ${input.email} | ${initialPassword} | ${input.business} | ${input.destination} | ${input.role === 'ADMIN' ? 'Complete MFA setup at first login' : 'Verified owner'} |`,
  );
  return user;
}
const destinations = [
  'Saudi Arabia',
  'UAE',
  'Turkey',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Oman',
  'Qatar',
  'Azerbaijan',
  'India',
];
for (const agency of demoAgencies) {
  const n = agency.number;
  const user = await ensureUser({
    id: stableUuid(1, n),
    email: agency.email,
    mobile: agency.phone,
    role: 'BUSINESS_USER',
    label: String(n),
    business: agency.name,
    destination: '/business',
  });
  const business = await db.business.upsert({
    where: { id: stableUuid(2, n) },
    update: {},
    create: {
      id: stableUuid(2, n),
      primaryOwnerId: user.id,
      status: 'APPROVED',
    },
  });
  const profile = await db.businessProfile.upsert({
    where: { publicSlug: agency.slug },
    update: {},
    create: {
      id: stableUuid(3, n),
      businessId: business.id,
      publicSlug: agency.slug,
      name: agency.name,
      businessType:
        n % 3 === 0 ? 'DMC' : n % 2 === 0 ? 'TOUR_OPERATOR' : 'TRAVEL_AGENCY',
      description: `Fictional Phase 6 demonstration agency specializing in ${agency.specialization.toLowerCase()}.`,
      headquartersCountry: agency.country,
      headquartersState: 'Synthetic Demo Region',
      headquartersCity: agency.city,
      publicEmail: agency.email,
      publicPhone: agency.phone,
      privateEmail: agency.email,
      privatePhone: agency.phone,
      website: `https://${agency.slug}.invalid`,
      yearsOperating: 4 + n,
      languages: ['English', 'Hindi'],
      marketsServed: ['India', 'UAE', 'Saudi Arabia'],
      capabilities: [
        'Hajj & Umrah',
        'Tourism',
        'Visa Assistance',
        'Ground Services',
      ],
      serviceCountries: destinations,
      serviceCities: ['Makkah', 'Madinah', 'Dubai', agency.city],
      licenceNumber: `SYNTHETIC-DEMO-${String(n).padStart(2, '0')}`,
      licenceIssuer: 'Fictional Demo Registry',
      verticals: ['HAJJ_UMRAH', 'TOURISM', 'VISA_SERVICES'],
    },
  });
  for (let i = 1; i <= 5; i++) {
    const start = new Date(Date.UTC(2027, (n + i) % 10, 2 + i)),
      end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 12 + i);
    const availability = {
      kind:
        i === 5
          ? ('ON_REQUEST' as const)
          : i % 2
            ? ('FIXED_DEPARTURE' as const)
            : ('DATE_RANGE' as const),
      startDate: i === 5 ? null : start,
      endDate: i === 5 ? null : end,
      blackoutDates: i === 5 ? [] : [new Date(start.getTime() + 259200000)],
      capacity: 12 + n + i,
    };
    await db.package.upsert({
      where: { id: stableUuid(10, n, i) },
      update: {},
      create: {
        id: stableUuid(10, n, i),
        profileId: profile.id,
        name: `${listingFamilies.pilgrimage[i - 1]} — ${agency.city} ${n}${i}`,
        subtype: i === 2 ? 'HAJJ' : 'UMRAH',
        status: 'PUBLISHED',
        sourceMarket: agency.market,
        departureCity: agency.city,
        destinationCities: ['Makkah', 'Madinah'],
        validFrom: start,
        validTo: end,
        totalNights: 9 + i,
        makkahNights: 5 + i,
        madinahNights: 4,
        minimumGroupSize: 2,
        maximumGroupSize: 12 + n + i,
        accommodation: {
          category: i > 3 ? 'Premium' : 'Comfort',
          cities: ['Makkah', 'Madinah'],
        },
        roomOccupancy: ['Double', 'Triple'],
        transport: {
          mode: i > 3 ? 'Private vehicle' : 'Air-conditioned coach',
        },
        meals: ['Breakfast'],
        visaStatus:
          'Documentation assistance only; approval is determined by the relevant authority.',
        ziyarat: ['Makkah', 'Madinah'],
        assistance: ['Bilingual coordinator'],
        inclusions: ['Accommodation', 'Ground transport'],
        exclusions: ['Personal expenses'],
        pricingMode: i === 5 ? 'ON_REQUEST' : 'FIXED',
        price: i === 5 ? null : 72000 + n * 2100 + i * 1700,
        currency: i === 5 ? null : 'INR',
        cancellationTerms:
          'Synthetic demonstration terms; no commercial booking is offered.',
        publishedAt: new Date(),
        availability: { create: availability },
      },
    });
    await db.tourismPackage.upsert({
      where: { id: stableUuid(11, n, i) },
      update: {},
      create: {
        id: stableUuid(11, n, i),
        profileId: profile.id,
        name: `${listingFamilies.tourism[i - 1]} — ${destinations[(n + i) % 10]} ${n}${i}`,
        description:
          'Synthetic demo itinerary with accommodation, transfers and guided activities.',
        status: 'PUBLISHED',
        sourceMarket: agency.market,
        departureCity: agency.city,
        destinationCountry: destinations[(n + i) % 10],
        destinationCities: [`Demo Destination ${n}-${i}`],
        category: ['HERITAGE', 'FAMILY', 'ADVENTURE', 'LUXURY', 'CULTURE'][
          i - 1
        ],
        durationDays: 4 + i,
        minimumGroupSize: 2,
        maximumGroupSize: 15 + n + i,
        accommodation: `${i + 2}-star category demonstration hotel`,
        transport: 'Airport transfers and scheduled coach',
        inclusions: ['Accommodation', 'Breakfast', 'Transfers'],
        exclusions: ['International flights', 'Personal expenses'],
        pricingMode: 'STARTING_FROM',
        price: 28000 + n * 1300 + i * 1900,
        currency: 'INR',
        publishedAt: new Date(),
        availability: { create: availability },
      },
    });
    await db.visaService.upsert({
      where: { id: stableUuid(12, n, i) },
      update: {},
      create: {
        id: stableUuid(12, n, i),
        profileId: profile.id,
        name: `${listingFamilies.visa[i - 1]} — ${destinations[(n + i + 2) % 10]} ${n}${i}`,
        description:
          'Synthetic document assistance. Approval, appointments and authority processing times are never guaranteed.',
        status: 'PUBLISHED',
        sourceMarket: agency.market,
        applicantNationality: n % 2 ? 'Indian' : 'UAE resident',
        destinationCountry: destinations[(n + i + 2) % 10],
        visaCategory: [
          'TOURIST',
          'BUSINESS',
          'FAMILY_VISIT',
          'STUDENT',
          'CONFERENCE',
        ][i - 1],
        processingRequirement:
          'Provide an intended travel date at least 30 days ahead; timing remains subject to the authority.',
        documentSummary:
          'Valid passport, photograph, itinerary and category-specific supporting evidence.',
        appointmentAssistance: i % 2 === 0,
        governmentFeeIncluded: false,
        pricingMode: 'FIXED',
        price: 1800 + n * 150 + i * 350,
        currency: 'INR',
        publishedAt: new Date(),
        availability: { create: { kind: 'ON_REQUEST', blackoutDates: [] } },
      },
    });
    await db.service.upsert({
      where: { id: stableUuid(13, n, i) },
      update: {},
      create: {
        id: stableUuid(13, n, i),
        profileId: profile.id,
        name: `${listingFamilies.ground[i - 1]} — ${['Jeddah', 'Makkah', 'Madinah', 'Dubai', 'Hyderabad'][i - 1]} ${n}${i}`,
        subtype: 'UMRAH',
        status: 'PUBLISHED',
        description: `Synthetic ground service for up to ${8 + n + i} passengers; ${i + 1} hour lead time, luggage subject to vehicle capacity.`,
        sourceMarket: agency.market,
        serviceCountry: i < 4 ? 'Saudi Arabia' : i === 4 ? 'UAE' : 'India',
        serviceCity: ['Jeddah', 'Makkah', 'Madinah', 'Dubai', 'Hyderabad'][
          i - 1
        ],
        pricingMode: i === 5 ? 'ON_REQUEST' : 'FIXED',
        price: i === 5 ? null : 2500 + n * 240 + i * 500,
        currency: i === 5 ? null : 'INR',
        availability: { create: availability },
      },
    });
  }
}
for (let i = 0; i < 2; i++)
  await ensureUser({
    id: stableUuid(20, i + 1),
    email: demoAdmins[i].email,
    role: 'ADMIN',
    label: String(11 + i),
    business: demoAdmins[i].name,
    destination: '/admin',
  });
if (!existingHandover)
  await writeFile(
    handoverPath,
    `# Phase 6 Demo Account Handover\n\nPrivate local file. Never commit or publish. Dataset: ${DEMO_DATA_VERSION}.\n\n| # | Role | Login Email | Initial Password | Associated Business | Destination | Notes |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
    { flag: 'wx' },
  );
const counts = await Promise.all([
  db.business.count(),
  db.user.count({ where: { email: { endsWith: '@phase6-demo.invalid' } } }),
  db.package.count({ where: { status: 'PUBLISHED' } }),
  db.tourismPackage.count({ where: { status: 'PUBLISHED' } }),
  db.visaService.count({ where: { status: 'PUBLISHED' } }),
  db.service.count({ where: { status: 'PUBLISHED' } }),
]);
console.log(
  JSON.stringify(
    {
      version: DEMO_DATA_VERSION,
      database: databaseName,
      businesses: counts[0],
      accounts: counts[1],
      pilgrimage: counts[2],
      tourism: counts[3],
      visa: counts[4],
      ground: counts[5],
      handover: handoverPath,
    },
    null,
    2,
  ),
);
await db.$disconnect();
