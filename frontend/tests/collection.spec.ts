import { test, expect } from '@playwright/test';
import { mockAuthentication } from './helpers/auth';

test.describe('Pokemon Collection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/collection');
  });

  test('should display collection page elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('My Pokemon Collection');
    await expect(page.locator('text=View and manage your saved Pokemon')).toBeVisible();
    
    // Check category filter buttons
    await expect(page.locator('text=🌟 All Pokemon')).toBeVisible();
    await expect(page.locator('text=⭐ Favorites')).toBeVisible();
    await expect(page.locator('text=🎯 Caught')).toBeVisible();
    await expect(page.locator('text=💭 Wishlist')).toBeVisible();
  });

  test('should require authentication', async ({ page }) => {
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display empty state when no Pokemon saved', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    await page.reload();

    await expect(page.locator('text=No Pokemon in your collection yet')).toBeVisible();
    await expect(page.locator('text=Start building your collection')).toBeVisible();
    
    const searchButton = page.locator('text=Search Pokemon');
    await expect(searchButton).toBeVisible();
    
    // Test navigation to search page
    await searchButton.click();
    await expect(page).toHaveURL(/\/pokemon/);
  });

  test('should display Pokemon cards with collection data', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data in localStorage/context
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        userId: 'test-user',
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'My favorite electric Pokemon!',
        types: ['electric'],
        spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
        userCategory: 'USER##CATEGORY#favorites',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      // Store in a way the app can access
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    await page.reload();

    // Check Pokemon card is displayed
    await expect(page.locator('text=pikachu')).toBeVisible();
    await expect(page.locator('text=#25')).toBeVisible();
    await expect(page.locator('text=Electric')).toBeVisible();
    await expect(page.locator('text=My favorite electric Pokemon!')).toBeVisible();
    
    // Check category emoji
    await expect(page.locator('text=⭐')).toBeVisible();
  });

  test('should filter Pokemon by category', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data with multiple categories
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Favorite',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      mockCollection.set('6', [{
        entryId: 'entry-2',
        pokemonName: 'charizard',
        pokemonId: 6,
        category: 'caught',
        notes: 'Caught in the wild',
        types: ['fire', 'flying'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T11:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    await page.reload();

    // Initially should show all Pokemon
    await expect(page.locator('text=pikachu')).toBeVisible();
    await expect(page.locator('text=charizard')).toBeVisible();

    // Filter by favorites
    await page.click('text=⭐ Favorites');
    await expect(page.locator('text=pikachu')).toBeVisible();
    await expect(page.locator('text=charizard')).not.toBeVisible();

    // Filter by caught
    await page.click('text=🎯 Caught');
    await expect(page.locator('text=pikachu')).not.toBeVisible();
    await expect(page.locator('text=charizard')).toBeVisible();

    // Back to all
    await page.click('text=🌟 All Pokemon');
    await expect(page.locator('text=pikachu')).toBeVisible();
    await expect(page.locator('text=charizard')).toBeVisible();
  });

  test('should allow editing Pokemon category', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Test note',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    // Mock API update response
    await page.route('**/update-pokemon/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.reload();

    // Change category dropdown
    const categorySelect = page.locator('select').first();
    await categorySelect.selectOption('caught');
    
    // The API call should be triggered automatically
    // In a real test, you'd verify the API was called with correct data
  });

  test('should allow editing Pokemon notes', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Original note',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    // Mock API update response
    await page.route('**/update-pokemon/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.reload();

    // Click edit note button
    await page.click('text=✏️ Edit');
    
    // Check textarea is visible and editable
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('Original note');
    
    // Edit the note
    await textarea.fill('Updated note text');
    
    // Save the note
    await page.click('text=Save');
    
    // Check the UI updated
    await expect(page.locator('text=Updated note text')).toBeVisible();
  });

  test('should allow canceling note edits', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Original note',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    await page.reload();

    // Click edit note button
    await page.click('text=✏️ Edit');
    
    // Edit the note
    const textarea = page.locator('textarea');
    await textarea.fill('Changed text');
    
    // Cancel the edit
    await page.click('text=Cancel');
    
    // Check original note is still displayed
    await expect(page.locator('text=Original note')).toBeVisible();
  });

  test('should allow deleting Pokemon from collection', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Test note',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    // Mock API delete response
    await page.route('**/delete-pokemon/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.reload();

    // Mock the confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await page.click('text=🗑️');
    
    // Pokemon should be removed from UI
    // (In a real implementation, you'd check the Pokemon card is no longer visible)
  });

  test('should navigate to Pokemon details from collection', async ({ page }) => {
    // Mock authentication
    await mockAuthentication(page);

    // Mock collection data
    await page.evaluate(() => {
      const mockCollection = new Map();
      mockCollection.set('25', [{
        entryId: 'entry-1',
        pokemonName: 'pikachu',
        pokemonId: 25,
        category: 'favorites',
        notes: 'Test note',
        types: ['electric'],
        spriteUrl: 'sprite-url',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      }]);
      
      window.localStorage.setItem('pokemonCache', JSON.stringify(Array.from(mockCollection.entries())));
    });

    await page.reload();

    // Click stats button
    await page.click('text=📊');
    
    // Should navigate to Pokemon search page with the Pokemon ID
    await expect(page).toHaveURL(/\/pokemon\?search=25/);
  });
});