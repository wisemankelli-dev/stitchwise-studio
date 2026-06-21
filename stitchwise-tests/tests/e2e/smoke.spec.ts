/**
 * Placeholder E2E smoke test for StitchWise Studio Portal.
 *
 * This test verifies that the web application loads and renders correctly.
 * It is expected to pass once the Frontend scaffold is in place at localhost:3000.
 */

import { test, expect } from '@playwright/test';

test.describe('StitchWise Studio Portal — Smoke Tests', () => {
  test('should load the landing page', async ({ page }) => {
    // Navigate to the app root
    await page.goto('/');

    // Verify the page loads with a title
    await expect(page).toHaveTitle(/StitchWise/);

    // Verify the main heading is present
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/StitchWise|stitchwise/i);
  });

  test('should have a navigation bar', async ({ page }) => {
    await page.goto('/');

    // Check for navigation element
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should display the footer', async ({ page }) => {
    await page.goto('/');

    // Check for footer element
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});
