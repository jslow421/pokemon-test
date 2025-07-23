import { test, expect } from '@playwright/test';

test.describe('Pokemon Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pokemon');
  });

  test('should display search form and image upload', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Pokemon Search & Identification');
    await expect(page.locator('input[placeholder*="Enter Pokemon name or ID"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText('Search');
    await expect(page.locator('text=📸 Identify by Image')).toBeVisible();
  });

  test('should require authentication for search', async ({ page }) => {
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');
    
    // Should redirect to login or show error
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation error for empty search', async ({ page }) => {
    // Mock authentication by setting localStorage token
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });
    
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Please enter a Pokemon name or ID')).toBeVisible();
  });

  test('should display loading state during search', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    
    // Mock a slow API response
    await page.route('**/pokemon/pikachu', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 25,
            name: 'pikachu',
            height: 4,
            weight: 60,
            base_experience: 112,
            sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
            cries: { latest: 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg' },
            types: [{ type: { name: 'electric' } }],
            stats: [
              { base_stat: 35, stat: { name: 'hp' } },
              { base_stat: 55, stat: { name: 'attack' } }
            ],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }]
          }
        })
      });
    });

    await page.click('button[type="submit"]');
    await expect(page.locator('button[type="submit"]')).toHaveText('Searching...');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should display Pokemon details after successful search', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    // Mock API response
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 25,
            name: 'pikachu',
            height: 4,
            weight: 60,
            base_experience: 112,
            sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
            cries: { latest: 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg' },
            types: [{ type: { name: 'electric' } }],
            stats: [
              { base_stat: 35, stat: { name: 'hp' } },
              { base_stat: 55, stat: { name: 'attack' } }
            ],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }]
          }
        })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Check Pokemon details are displayed
    await expect(page.locator('text=pikachu')).toBeVisible();
    await expect(page.locator('text=#25')).toBeVisible();
    await expect(page.locator('text=Electric')).toBeVisible();
    await expect(page.locator('text=Physical Stats')).toBeVisible();
    await expect(page.locator('text=Battle Stats')).toBeVisible();
    await expect(page.locator('text=Abilities')).toBeVisible();
    await expect(page.locator('text=Save to Collection')).toBeVisible();
  });

  test('should handle search errors gracefully', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    // Mock API error response
    await page.route('**/pokemon/invalidpokemon', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Pokemon not found' })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'invalidpokemon');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Pokemon not found')).toBeVisible();
  });

  test('should allow saving Pokemon to collection', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    // Mock Pokemon search response
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 25,
            name: 'pikachu',
            height: 4,
            weight: 60,
            sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
            types: [{ type: { name: 'electric' } }],
            stats: [{ base_stat: 35, stat: { name: 'hp' } }],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }]
          }
        })
      });
    });

    // Mock save Pokemon response
    await page.route('**/save-pokemon', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, entryId: 'test-entry-id' })
      });
    });

    // Search for Pokemon
    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Wait for Pokemon details to load
    await expect(page.locator('text=pikachu')).toBeVisible();

    // Change category and add notes
    await page.selectOption('select', 'caught');
    await page.fill('textarea[placeholder*="Add your notes"]', 'My first electric Pokemon!');

    // Save to collection
    await page.click('text=Save to caught');
    
    await expect(page.locator('text=✅ pikachu saved to caught!')).toBeVisible();
  });

  test('should handle image upload validation', async ({ page }) => {
    // Test file type validation
    const fileInput = page.locator('input[type="file"]');
    
    // This would normally require a real file, but we can test the UI elements
    await expect(page.locator('text=Click to upload a Pokemon image')).toBeVisible();
    await expect(page.locator('text=PNG, JPG, WebP up to 5MB')).toBeVisible();
  });
});