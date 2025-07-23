import { test, expect } from '@playwright/test';
import { mockAuthentication } from './helpers/auth';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to establish context first
    await page.goto('/');
    // Clear authentication before each test
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check login page elements
    await expect(page.locator('body')).toBeVisible();
    // Add more specific checks based on your login page implementation
  });

  test('should redirect unauthenticated users from protected pages', async ({ page }) => {
    // Try to access protected Pokemon search page
    await page.goto('/pokemon');
    
    // Should redirect to login (this happens client-side in the component)
    // The exact behavior depends on your auth implementation
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from collection page', async ({ page }) => {
    await page.goto('/collection');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow access to protected pages when authenticated', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    await page.goto('/pokemon');
    
    // Should stay on Pokemon page
    await expect(page).toHaveURL(/\/pokemon/);
    await expect(page.locator('h1')).toContainText('Pokemon Search');
  });

  test('should maintain authentication state across page reloads', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    await page.goto('/pokemon');
    await expect(page).toHaveURL(/\/pokemon/);
    
    // Reload page
    await page.reload();
    
    // Should still be authenticated and on the same page
    await expect(page).toHaveURL(/\/pokemon/);
    await expect(page.locator('h1')).toContainText('Pokemon Search');
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Mock authentication with invalid token
    await page.goto('/');
    await page.addInitScript(() => {
      window.localStorage.setItem('authToken', 'invalid-token');
    });

    // Mock API calls to return 401 errors
    await page.route('**/pokemon/**', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });

    await page.goto('/pokemon');
    
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');
    
    // Should handle 401 error gracefully
    await expect(page.locator('text=Please login to search for Pokemon')).toBeVisible();
  });

  test('should log out user and redirect appropriately', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    await page.goto('/pokemon');
    
    // Mock logout functionality (this would depend on your implementation)
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
    });
    
    // Try to make an API call that requires authentication
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});