import { describe, expect, it } from 'vitest';
import { cityDisplayName } from './city-names';

describe('cityDisplayName', () => {
  it('shows a known Arabic name on the Arabic page', () => {
    expect(cityDisplayName('Amman', 'ar')).toBe('عمّان');
    expect(cityDisplayName('  new   york ', 'ar')).toBe('نيويورك');
    expect(cityDisplayName('Riyadh, Saudi Arabia', 'ar')).toBe('الرياض');
  });
  it('keeps the city as typed otherwise', () => {
    expect(cityDisplayName('Amman', 'en')).toBe('Amman');
    expect(cityDisplayName('عمان', 'ar')).toBe('عمان');
    expect(cityDisplayName('Smalltown', 'ar')).toBe('Smalltown');
  });
});
