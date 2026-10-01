import { describe, expect, it } from 'vitest';
import {
  marketplaceQuerySchema,
  comparisonSchema,
} from '@b2b/validation/marketplace';
describe('bounded public search', () => {
  it('accepts existing PostgreSQL UUID identifiers without rewriting demo records', () => {
    expect(
      comparisonSchema.safeParse({
        packageIds: [
          '60000000-0000-0010-0001-000000000001',
          '60000000-0000-0010-0001-000000000002',
        ],
      }).success,
    ).toBe(true);
    expect(
      comparisonSchema.safeParse({
        packageIds: ["'; DROP TABLE packages", 'invalid'],
      }).success,
    ).toBe(false);
  });
  it('rejects date expansion and unbounded pagination abuse', () => {
    expect(
      marketplaceQuerySchema.safeParse({
        startDate: '0001-01-01',
        endDate: '9999-12-31',
      }).success,
    ).toBe(false);
    expect(marketplaceQuerySchema.safeParse({ page: 1000000000 }).success).toBe(
      false,
    );
    expect(
      marketplaceQuerySchema.safeParse({
        startDate: '2026-10-01',
        endDate: '2026-10-15',
        pageSize: 12,
      }).success,
    ).toBe(true);
  });
});
