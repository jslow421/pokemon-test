import { test, expect } from '@playwright/test';

test.describe('Basic App Tests', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome to Pokemon');
  });

  test('should have working localStorage', async ({ page }) => {
    await page.goto('/');
    
    // Test localStorage access
    await page.evaluate(() => {
      window.localStorage.setItem('test', 'value');
    });
    
    const value = await page.evaluate(() => {
      return window.localStorage.getItem('test');
    });
    
    expect(value).toBe('value');
  });

  test('should navigate to Pokemon page', async ({ page }) => {
    await page.goto('/pokemon');
    await expect(page.locator('h1')).toContainText('Pokemon Search');
  });

  test('should navigate to Collection page and redirect to login', async ({ page }) => {
    await page.goto('/collection');
    // Should redirect to login since not authenticated
    await expect(page).toHaveURL(/\/login/);
  });
});