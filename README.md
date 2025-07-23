# Pokemon AI Demo Project

A demo application that interfaces with the Pokemon API and AWS services to perform AI-powered Pokemon operations like converting images into Pokemon representations, Pokemon search based on uploaded images, and other Pokemon-related AI features.

## Project Structure

```
/
├── backend/           # Go backend service
├── frontend/          # Next.js static app  
├── infra/            # CDK infrastructure code
└── README.md         # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Go 1.24+
- AWS CLI configured with appropriate credentials

### Backend (Go API)

#### Running the Backend

```bash
cd backend
go run .
```

The backend will start on port 8181.

#### Running Backend Tests

```bash
cd backend
go test ./handlers/
```

### Frontend (Next.js)

#### Installing Dependencies

```bash
cd frontend
npm install
```

#### Running the Frontend

Development mode:
```bash
cd frontend
npm run dev
```

Production build:
```bash
cd frontend
npm run build
npm start
```

#### Running Frontend Tests (Playwright)

Basic test run:
```bash
cd frontend
npm test
```

Run tests with browser UI:
```bash
cd frontend
npm run test:headed
```

Run tests with Playwright UI mode:
```bash
cd frontend
npm run test:ui
```

Debug tests:
```bash
cd frontend
npm run test:debug
```

### Development Workflow

1. Start the backend: `cd backend && go run .`
2. Start the frontend: `cd frontend && npm run dev`
3. Access the application at `http://localhost:3000`

### Testing

- **Go Unit Tests**: `cd backend && go test ./handlers/`
- **Playwright E2E Tests**: `cd frontend && npm test`

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Go with standard library, AWS SDK
- **Database**: DynamoDB
- **Authentication**: AWS Cognito with JWT
- **AI Services**: AWS Bedrock for image analysis
