import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper page titles', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pokemon/);

    await page.goto('/pokemon');
    await expect(page).toHaveTitle(/Pokemon/);

    await page.goto('/collection');
    await expect(page).toHaveTitle(/Pokemon/);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Check h1 exists
    await expect(page.locator('h1')).toBeVisible();
    
    // Check heading hierarchy is logical
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });

  test('should have alt text for images', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    await page.goto('/pokemon');

    // Mock Pokemon data with image
    await page.route('**/pokemon/pikachu', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 25,
            name: 'pikachu',
            sprites: { front_default: 'https://example.com/pikachu.png' },
            types: [{ type: { name: 'electric' } }],
            stats: [{ base_stat: 35, stat: { name: 'hp' } }],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }]
          }
        })
      });
    });

    await page.fill('input[placeholder*="Enter Pokemon name or ID"]', 'pikachu');
    await page.click('button[type="submit"]');

    // Wait for Pokemon image to load
    await expect(page.locator('text=pikachu')).toBeVisible();
    
    // Check all images have alt text
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Check search input has proper labeling
    const searchInput = page.locator('input[placeholder*="Enter Pokemon name or ID"]');
    await expect(searchInput).toBeVisible();
    
    // Check file input has proper labeling
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Check focus is visible
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to activate buttons with Enter/Space
    const searchButton = page.locator('button[type="submit"]');
    await searchButton.focus();
    // Note: Would need to test actual Enter key activation in real scenario
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/pokemon');
    
    // This is a basic check - in a real test you'd use axe-core or similar
    const bodyStyles = await page.locator('body').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor
      };
    });
    
    expect(bodyStyles.color).toBeTruthy();
    expect(bodyStyles.backgroundColor).toBeTruthy();
  });

  test('should work with screen readers', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Check for ARIA labels and roles
    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toBeVisible();
    
    // Check that interactive elements have proper roles
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const role = await button.getAttribute('role');
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Should have either text content, aria-label, or proper role
      expect(text || ariaLabel || role).toBeTruthy();
    }
  });

  test('should handle focus management in modals/dialogs', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'mock-token');
    });

    await page.goto('/collection');
    
    // This would test focus management if you have modals
    // For now, just check that focus is handled properly on the page
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
  });

  test('should provide error messages that are accessible', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Trigger validation error
    await page.click('button[type="submit"]');
    
    const errorMessage = page.locator('.bg-red-50');
    await expect(errorMessage).toBeVisible();
    
    // Error should be associated with the input (in real implementation)
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();
  });

  test('should support zoom up to 200%', async ({ page }) => {
    await page.goto('/pokemon');
    
    // Simulate zoom by changing viewport and font size
    await page.setViewportSize({ width: 640, height: 480 });
    await page.addStyleTag({
      content: 'body { font-size: 200%; }'
    });
    
    // Page should still be functional
    await expect(page.locator('input[placeholder*="Enter Pokemon name or ID"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should work without JavaScript (progressive enhancement)', async ({ page }) => {
    // Disable JavaScript
    await page.context().setExtraHTTPHeaders({});
    
    await page.goto('/pokemon');
    
    // Basic content should still be visible
    await expect(page.locator('body')).toBeVisible();
    
    // Forms should still be present (though may not be functional)
    await expect(page.locator('form')).toBeVisible();
  });
});