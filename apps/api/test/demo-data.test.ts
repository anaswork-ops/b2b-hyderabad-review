import { describe, expect, it } from 'vitest';
import {
  demoAdmins,
  demoAgencies,
  listingFamilies,
  stableUuid,
} from '../src/demo-data.js';

describe('Phase 6 demo definition', () => {
  it('defines exactly ten distinct suppliers, twelve accounts and 200 stable listings', () => {
    expect(demoAgencies).toHaveLength(10);
    expect(demoAdmins).toHaveLength(2);
    expect(new Set(demoAgencies.map((x) => x.email)).size).toBe(10);
    expect(new Set(demoAgencies.map((x) => x.slug)).size).toBe(10);
    expect(Object.values(listingFamilies).every((x) => x.length === 5)).toBe(
      true,
    );
    const ids = Object.keys(listingFamilies).flatMap((_, kind) =>
      demoAgencies.flatMap((agency) =>
        listingFamilies.pilgrimage.map((__, item) =>
          stableUuid(10 + kind, agency.number, item + 1),
        ),
      ),
    );
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
  });
});
