# Playwright Tests for Pokemon App

This directory contains comprehensive end-to-end tests for the Pokemon application using Playwright.

## Test Structure

### Core Feature Tests
- **`pokemon-search.spec.ts`** - Tests for Pokemon search functionality, including text search, validation, loading states, and saving to collection
- **`collection.spec.ts`** - Tests for the Pokemon collection page, including filtering, editing, and management features
- **`image-identification.spec.ts`** - Tests for image upload and AI-powered Pokemon identification features

### System Tests
- **`navigation.spec.ts`** - Tests for page navigation, routing, and responsive design
- **`authentication.spec.ts`** - Tests for authentication flows and protected routes
- **`api-integration.spec.ts`** - Tests for API error handling, retries, and edge cases
- **`accessibility.spec.ts`** - Tests for accessibility compliance and keyboard navigation

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests with browser visible
npm run test:headed

# Run tests with Playwright UI
npm run test:ui

# Debug tests
npm run test:debug
```

### Specific Test Files
```bash
# Run specific test file
npx playwright test pokemon-search.spec.ts

# Run tests matching a pattern
npx playwright test --grep "search"

# Run tests in a specific browser
npx playwright test --project=chromium
```

## Test Features

### Authentication Mocking
Tests mock authentication by setting localStorage tokens:
```typescript
await page.evaluate(() => {
  localStorage.setItem('authToken', 'mock-token');
});
```

### API Response Mocking
Tests use Playwright's route interception to mock API responses:
```typescript
await page.route('**/pokemon/pikachu', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: pokemonData })
  });
});
```

### Key Test Scenarios

#### Pokemon Search Tests
- ✅ Form validation and error handling
- ✅ Authentication requirements
- ✅ Loading states and user feedback
- ✅ Pokemon data display and formatting
- ✅ Save to collection functionality
- ✅ Image upload validation

#### Collection Tests
- ✅ Empty state handling
- ✅ Pokemon card display
- ✅ Category filtering
- ✅ Note editing (inline)
- ✅ Pokemon deletion with confirmation
- ✅ Navigation to Pokemon details

#### Image Identification Tests
- ✅ File upload interface
- ✅ Image preview and clearing
- ✅ AI identification process
- ✅ Confidence level handling
- ✅ Integration with search results

#### System Tests
- ✅ Cross-page navigation
- ✅ Authentication state management
- ✅ API error handling and retries
- ✅ Responsive design testing
- ✅ Accessibility compliance

## Test Configuration

The tests are configured to:
- Run against `http://localhost:3001`
- Start the dev server automatically
- Support parallel execution
- Generate HTML reports
- Include trace collection on failures

## Best Practices

### Test Organization
- Each test file focuses on a specific feature area
- Tests are independent and can run in any order
- Shared setup is handled in `beforeEach` hooks

### Mocking Strategy
- Authentication is mocked via localStorage
- API responses are mocked at the network level
- Test data is minimal but realistic

### Assertions
- Use semantic locators when possible
- Test user-visible behavior, not implementation details
- Include both positive and negative test cases

## Maintenance

### Adding New Tests
1. Create tests in the appropriate spec file
2. Follow existing patterns for mocking and assertions
3. Ensure tests are independent and reliable

### Updating Tests
- Update mocks when API contracts change
- Review tests when UI components are modified
- Keep test data current with application features

## Debugging Tips

1. Use `test.only()` to run single tests
2. Add `await page.pause()` to stop execution and inspect
3. Use `--headed` mode to see browser interactions
4. Check the trace files for failed tests
5. Use `console.log()` in page.evaluate() for debugging client-side code