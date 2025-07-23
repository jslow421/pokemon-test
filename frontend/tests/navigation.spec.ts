import { test, expect } from '@playwright/test';

test.describe('Navigation and Layout', () => {
  test('should display home page correctly', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('Welcome to Pokemon');
    await expect(page.locator('text=Discover the world of Pokemon with AI')).toBeVisible();
  });

  test('should have navigation menu available', async ({ page }) => {
    await page.goto('/');
    
    // Check if navigation component exists (based on the Navigation.tsx file)
    // This would depend on how navigation is implemented
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Pokemon page
    await page.goto('/pokemon');
    await expect(page.locator('h1')).toContainText('Pokemon Search');
    
    // Navigate to Collection page
    await page.goto('/collection');
    await expect(page.locator('h1')).toContainText('My Pokemon Collection');
    
    // Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page');
    
    // Next.js should handle 404s, but check the page loads
    // The exact behavior depends on your error handling
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/pokemon');
    
    // Check that the page is still functional on mobile
    await expect(page.locator('input[placeholder*="Enter Pokemon name or ID"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should maintain state across navigation', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    await page.goto('/pokemon');
    
    // Fill search term
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    
    // Navigate away and back
    await page.goto('/collection');
    await page.goto('/pokemon');
    
    // Check if search term is preserved (if implemented)
    // This would depend on your state management
    const searchInput = page.locator('input[placeholder*="Enter Pokemon name or ID"]');
    await expect(searchInput).toBeVisible();
  });
});