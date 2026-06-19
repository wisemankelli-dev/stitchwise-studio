/**
 * Placeholder E2E smoke test for StitchWise Studio Portal.
 *
 * This test verifies that the web application loads and renders correctly.
 * It is expected to pass once the Frontend scaffold is in place at localhost:3000.
 */

import { test, expect } from '@playwright/test';

test.describe('StitchWise Studio Portal — Smoke Tests', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/StitchWise/);
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/StitchWise|stitchwise/i);
  });

  test('should have a navigation bar', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should display the footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});