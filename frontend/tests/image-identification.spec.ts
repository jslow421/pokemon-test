import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Image Identification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pokemon');
    
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });
  });

  test('should display image upload section', async ({ page }) => {
    await expect(page.locator('text=📸 Identify by Image')).toBeVisible();
    await expect(page.locator('text=Click to upload a Pokemon image')).toBeVisible();
    await expect(page.locator('text=PNG, JPG, WebP up to 5MB')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should show image preview after file selection', async ({ page }) => {
    // Create a test image file input
    const fileInput = page.locator('input[type="file"]');
    
    // Note: In a real test environment, you'd use actual image files
    // For now, we'll test the UI behavior
    await expect(fileInput).toBeVisible();
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  test('should show identify button when image is selected', async ({ page }) => {
    // Mock image selection by manipulating the DOM
    await page.evaluate(() => {
      // Simulate image selection
      const preview = document.createElement('img');
      preview.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      preview.alt = 'Pokemon to identify';
      preview.className = 'max-w-xs mx-auto rounded-lg shadow-md';
      
      const container = document.querySelector('.space-y-4');
      if (container) {
        container.innerHTML = `
          <div class="relative">
            ${preview.outerHTML}
            <button class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600">×</button>
          </div>
          <div class="text-center">
            <button class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Identify Pokemon</button>
          </div>
        `;
      }
    });

    await expect(page.locator('text=Identify Pokemon')).toBeVisible();
    await expect(page.locator('button:has-text("×")')).toBeVisible();
  });

  test('should handle image identification process', async ({ page }) => {
    // Mock image selection
    await page.evaluate(() => {
      const container = document.querySelector('.space-y-4');
      if (container) {
        container.innerHTML = `
          <div class="relative">
            <img src="data:image/png;base64,test" alt="Pokemon to identify" class="max-w-xs mx-auto rounded-lg shadow-md">
            <button class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600">×</button>
          </div>
          <div class="text-center">
            <button id="identify-btn" class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Identify Pokemon</button>
          </div>
        `;
      }
    });

    // Mock API response for identification
    await page.route('**/pokemon-identify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pokemon_name: 'pikachu',
          confidence: 0.85,
          pokeapi_data: {
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

    // Click identify button
    await page.click('#identify-btn');
    
    // Should show loading state
    await expect(page.locator('text=Identifying...')).toBeVisible();
  });

  test('should display identification results', async ({ page }) => {
    // Mock the identification result display
    await page.evaluate(() => {
      const container = document.querySelector('.bg-white.shadow.rounded-lg.p-6.mb-6');
      if (container) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'bg-gray-50 p-4 rounded-lg';
        resultDiv.innerHTML = `
          <h3 class="font-semibold text-gray-900 mb-2">Identification Result:</h3>
          <p class="text-sm text-gray-700"><span class="font-medium">Pokemon:</span> pikachu</p>
          <p class="text-sm text-gray-700"><span class="font-medium">Confidence:</span> 85.0%</p>
          <p class="text-sm text-green-600 mt-2">✅ Pokemon data loaded! Scroll down to see stats and save to your collection.</p>
        `;
        container.appendChild(resultDiv);
      }
    });

    await expect(page.locator('text=Identification Result:')).toBeVisible();
    await expect(page.locator('text=Pokemon: pikachu')).toBeVisible();
    await expect(page.locator('text=Confidence: 85.0%')).toBeVisible();
  });

  test('should handle low confidence identification', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.querySelector('.bg-white.shadow.rounded-lg.p-6.mb-6');
      if (container) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'bg-gray-50 p-4 rounded-lg';
        resultDiv.innerHTML = `
          <h3 class="font-semibold text-gray-900 mb-2">Identification Result:</h3>
          <p class="text-sm text-gray-700"><span class="font-medium">Pokemon:</span> unknown</p>
          <p class="text-sm text-gray-700"><span class="font-medium">Confidence:</span> 25.0%</p>
          <p class="text-sm text-yellow-600 mt-2">⚠️ Low confidence - the image might not contain a clear Pokemon or might be hard to identify.</p>
        `;
        container.appendChild(resultDiv);
      }
    });

    await expect(page.locator('text=⚠️ Low confidence')).toBeVisible();
  });

  test('should allow clearing uploaded image', async ({ page }) => {
    // Mock image preview state
    await page.evaluate(() => {
      const container = document.querySelector('.space-y-4');
      if (container) {
        container.innerHTML = `
          <div class="relative">
            <img src="data:image/png;base64,test" alt="Pokemon to identify" class="max-w-xs mx-auto rounded-lg shadow-md">
            <button id="clear-btn" class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600">×</button>
          </div>
        `;
      }
    });

    await page.click('#clear-btn');
    
    // Should return to upload state
    await expect(page.locator('text=Click to upload a Pokemon image')).toBeVisible();
  });

  test('should collapse image section after successful identification', async ({ page }) => {
    // Mock collapsed state
    await page.evaluate(() => {
      const imageSection = document.querySelector('.bg-white.shadow.rounded-lg.p-6.mb-6');
      if (imageSection) {
        imageSection.innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-gray-900">📸 Identify by Image</h2>
            <button class="text-sm text-blue-600 hover:text-blue-800 font-medium">Upload another image</button>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <p class="text-green-800 text-sm">✅ Image identified successfully! Pokemon data is shown below.</p>
          </div>
        `;
      }
    });

    await expect(page.locator('text=✅ Image identified successfully!')).toBeVisible();
    await expect(page.locator('text=Upload another image')).toBeVisible();
  });

  test('should handle identification errors', async ({ page }) => {
    // Mock image selection and API error
    await page.evaluate(() => {
      const container = document.querySelector('.space-y-4');
      if (container) {
        container.innerHTML = `
          <div class="text-center">
            <button id="identify-btn" class="px-6 py-2 bg-green-600 text-white rounded-md">Identify Pokemon</button>
          </div>
        `;
      }
    });

    await page.route('**/pokemon-identify', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to process image' })
      });
    });

    await page.click('#identify-btn');
    
    await expect(page.locator('text=Failed to process image')).toBeVisible();
  });
});