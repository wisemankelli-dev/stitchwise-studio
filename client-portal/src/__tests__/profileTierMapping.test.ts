/**
 * Tests for the backend tier → frontend display-tier mapping used by
 * getUserProfile() (GET /api/me returns tier: "HOBBYIST" | "PRO" | "STUDIO").
 *
 * Owner-approved (09-03): the Dashboard must never blank just because a
 * profile call fails, and the backend tier enum must map to the frontend
 * User.subscriptionTier display strings.
 */
import { describe, it, expect } from 'vitest';
import { mapBackendTier } from '../services/api';

describe('mapBackendTier', () => {
  it('maps backend HOBBYIST to "Hobbyist"', () => {
    expect(mapBackendTier('HOBBYIST')).toBe('Hobbyist');
  });

  it('maps backend PRO to "Pro Crafter"', () => {
    expect(mapBackendTier('PRO')).toBe('Pro Crafter');
  });

  it('maps backend STUDIO to "Design Studio"', () => {
    expect(mapBackendTier('STUDIO')).toBe('Design Studio');
  });

  it('accepts humanized/lowercase variants defensively', () => {
    expect(mapBackendTier('Pro Crafter')).toBe('Pro Crafter');
    expect(mapBackendTier('design_studio')).toBe('Design Studio');
    expect(mapBackendTier('pro_crafter')).toBe('Pro Crafter');
  });

  it('falls back to "Hobbyist" for unknown/empty values', () => {
    expect(mapBackendTier('UNKNOWN')).toBe('Hobbyist');
    expect(mapBackendTier('')).toBe('Hobbyist');
    expect(mapBackendTier(undefined)).toBe('Hobbyist');
    expect(mapBackendTier(null)).toBe('Hobbyist');
  });
});