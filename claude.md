# Pokemon AI Demo Project

## Project Overview

A demo application that interfaces with the Pokemon API and AWS services to perform AI-powered Pokemon operations like:

- Converting images into Pokemon representations
- Pokemon search based on uploaded images
- Other Pokemon-related AI features

This is a single-day demo project with three main components: frontend, backend, and infrastructure.

## Architecture

### Frontend (`/frontend`)

- **Framework**: Next.js with static export (no SSR)
- **Language**: TypeScript exclusively
- **Styling**: Tailwind CSS
- **Components**: Use well-known component libraries that work with Tailwind (shadcn/ui, Headless UI, etc.)
- **Package Manager**: npm
- **Formatting**: Prettier

### Backend (`/backend`)

- **Language**: Go
- **Philosophy**: Prioritize Go standard library, only use third-party libraries when compelling
- **Database**: DynamoDB (if needed)
- **Authentication**: JWT
- **Formatting**: gofmt

### Infrastructure (`/infra`)

- **Tool**: AWS CDK
- **Target**: Docker container deployment to ECS
- **Container**: Should bootstrap the built static Next.js app

## Folder Structure

```
/
├── backend/           # Go backend service
├── frontend/          # Next.js static app
├── infra/            # CDK infrastructure code
└── claude.md         # This file
```

## Development Standards

### Frontend Standards

- All code must be TypeScript
- Use Tailwind for all styling
- Components should be functional components with hooks
- Prefer composition over inheritance
- Use proper TypeScript types, avoid `any`
- Format with Prettier
- Build as static export (`next export`)

### Backend Standards

- Use Go standard library whenever possible
- Follow Go naming conventions (PascalCase for exports, camelCase for private)
- Prefer explicit error handling over exceptions
- Keep handlers simple and delegate to service layer
- Use `go mod` for dependency management
- Format with `gofmt`
- Structure: handlers -> services -> repositories pattern

### Infrastructure Standards

- Use AWS CDK with TypeScript
- Follow AWS Well-Architected principles
- Container should serve the static Next.js build
- Keep infrastructure simple for demo purposes

## Key Integrations

### Pokemon API

- Base URL: `https://pokeapi.co/api/v2/`
- JWT authentication for backend
- RESTful endpoints for Pokemon data
- Handle rate limiting gracefully

### AWS Services

- **DynamoDB**: For any persistent data storage needs
- **ECS**: For container deployment
- **S3**: Likely for image storage/processing
- **Other services**: As needed for AI features (Rekognition, Bedrock, etc.)

## Code Style Preferences

### Go Code Style

```go
// Prefer explicit error handling
result, err := someOperation()
if err != nil {
    return fmt.Errorf("operation failed: %w", err)
}

// Use standard library HTTP patterns
func handler(w http.ResponseWriter, r *http.Request) {
    // Implementation
}

// Simple struct definitions
type Pokemon struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}
```

### TypeScript/React Style

```typescript
// Functional components with proper typing
interface PokemonCardProps {
  pokemon: Pokemon;
  onSelect: (pokemon: Pokemon) => void;
}

const PokemonCard: React.FC<PokemonCardProps> = ({ pokemon, onSelect }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Component content */}
    </div>
  );
};

// Use proper async/await patterns
const fetchPokemon = async (id: number): Promise<Pokemon> => {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch Pokemon");
  }
  return response.json();
};
```

## Common Patterns

### API Communication

- Frontend calls backend APIs, not Pokemon API directly
- Backend handles all external API calls
- Use proper HTTP status codes
- Handle errors gracefully with user-friendly messages

### Image Handling

- Accept common image formats (JPEG, PNG, WebP)
- Validate file sizes and types
- Process images server-side
- Return structured responses

### Error Handling

- Go: Return errors explicitly, wrap with context
- TypeScript: Use try/catch with async/await, provide user feedback
- Always log errors server-side
- Never expose internal errors to frontend

## Development Workflow

1. Start with backend API endpoints
2. Build frontend components to consume APIs
3. Infrastructure comes last for deployment
4. Test locally before containerizing
5. Keep it simple - this is a demo

## Notes

- This is a single-day demo project - prioritize working features over perfect architecture
- JWT authentication for backend
- Focus on core Pokemon AI functionality
- Container deployment is the end goal but start with local development
