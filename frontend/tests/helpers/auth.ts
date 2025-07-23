import { Page } from '@playwright/test';

export async function mockAuthentication(page: Page) {
  // Navigate to the page first to establish context
  await page.goto('/');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Set authentication token in localStorage
  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'mock-token-123');
  });
  
  // Optionally set additional auth state
  await page.evaluate(() => {
    // Mock any other auth-related localStorage or sessionStorage items
    window.localStorage.setItem('authUser', JSON.stringify({
      id: 'test-user-123',
      email: 'test@example.com'
    }));
  });
}

export async function clearAuthentication(page: Page) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}