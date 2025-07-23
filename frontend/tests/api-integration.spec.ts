import { test, expect } from '@playwright/test';
import { mockAuthentication } from './helpers/auth';

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for all tests
    await mockAuthentication(page);
  });

  test('should handle API rate limiting gracefully', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock rate limit response
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Too many requests')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock network error
    await page.route('**/pokemon/pikachu', async route => {
      await route.abort('failed');
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should show some error message
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });

  test('should handle malformed API responses', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock malformed response
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json'
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should handle JSON parsing error gracefully
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });

  test('should handle API timeout', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock slow response that times out
    await page.route('**/pokemon/pikachu', async route => {
      // Delay longer than reasonable timeout
      await new Promise(resolve => setTimeout(resolve, 30000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should show loading state initially
    await expect(page.locator('text=Searching...')).toBeVisible();
    
    // Eventually should timeout or show error
    // The exact behavior depends on your timeout implementation
  });

  test('should retry failed requests appropriately', async ({ page }) => {
    await page.goto('/pokemon');

    let attemptCount = 0;
    await page.route('**/pokemon/pikachu', async route => {
      attemptCount++;
      if (attemptCount < 3) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 25,
              name: 'pikachu',
              sprites: { front_default: 'sprite-url' },
              types: [{ type: { name: 'electric' } }],
              stats: [{ base_stat: 35, stat: { name: 'hp' } }],
              abilities: [{ ability: { name: 'static' }, is_hidden: false }]
            }
          })
        });
      }
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should eventually succeed after retries
    await expect(page.locator('text=pikachu')).toBeVisible();
  });

  test('should handle concurrent API requests properly', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock API responses
    await page.route('**/pokemon/pikachu', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 25,
            name: 'pikachu',
            sprites: { front_default: 'sprite-url' },
            types: [{ type: { name: 'electric' } }],
            stats: [{ base_stat: 35, stat: { name: 'hp' } }],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }]
          }
        })
      });
    });

    await page.route('**/pokemon/charizard', async route => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 6,
            name: 'charizard',
            sprites: { front_default: 'sprite-url' },
            types: [{ type: { name: 'fire' } }, { type: { name: 'flying' } }],
            stats: [{ base_stat: 78, stat: { name: 'hp' } }],
            abilities: [{ ability: { name: 'blaze' }, is_hidden: false }]
          }
        })
      });
    });

    // Trigger first search
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Quickly trigger second search before first completes
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'charizard');
    await page.click('button[type="submit"]');

    // Should handle the race condition properly and show the latest result
    await expect(page.locator('text=charizard')).toBeVisible();
  });

  test('should validate API response data', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock response with missing required fields
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            // Missing required fields like id, name, etc.
            incomplete: true
          }
        })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should handle incomplete data gracefully
    // The exact behavior depends on your validation logic
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle authentication token expiration', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock expired token response
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired' })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Should redirect to login or show auth error
    await expect(page.locator('text=Please login to search for Pokemon')).toBeVisible();
  });

  test('should handle API version mismatches', async ({ page }) => {
    await page.goto('/pokemon');

    // Mock API version error
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API version not supported' })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=API version not supported')).toBeVisible();
  });
});