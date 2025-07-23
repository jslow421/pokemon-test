# Pokemon AI Demo - Cognito Authentication Deployment

## Overview

This setup uses AWS Cognito for authentication with a static frontend and Go backend. The frontend remains static and passes credentials to the Go backend, which handles all Cognito operations.

## Infrastructure Deployment

### 1. Deploy CDK Stack

```bash
cd infra
npm install
npm run build
cdk deploy
```

After deployment, note the outputs:
- `UserPoolId` - The Cognito User Pool ID
- `UserPoolClientId` - The Cognito User Pool Client ID  
- `UserPoolProviderURL` - The JWT validation URL

### 2. Create a Test User

After deployment, create a test user in the Cognito User Pool:

```bash
# Replace YOUR_USER_POOL_ID with the actual User Pool ID from CDK output
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username testuser \
  --user-attributes Name=email,Value=test@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username testuser \
  --password TestPass123! \
  --permanent
```

## Backend Configuration

### Environment Variables

Set these environment variables for the Go backend:

```bash
export COGNITO_USER_POOL_ID="your-user-pool-id"
export COGNITO_CLIENT_ID="your-client-id"
export AWS_REGION="us-east-1"  # or your preferred region
# COGNITO_CLIENT_SECRET is optional - only needed if you enable client secret
```

### Running the Backend

```bash
cd backend
go build -o server .
./server
```

The server will start on port 8181 and log reminders about required environment variables.

## Frontend

The frontend remains unchanged - it's a static Next.js app that:
- Sends username/password to `/login` endpoint
- Receives JWT tokens from the backend
- Stores tokens in sessionStorage
- Includes tokens in Authorization headers for protected endpoints

```bash
cd frontend
npm run dev
```

## Authentication Flow

1. **User Login**: Frontend sends credentials to `/login`
2. **Backend Authentication**: Go backend authenticates with Cognito using AWS SDK
3. **Token Return**: Backend returns Cognito ID token to frontend
4. **Token Usage**: Frontend includes ID token in Authorization header
5. **Token Validation**: Backend validates token against Cognito JWK endpoint

## API Endpoints

- `GET /` - Public hello world endpoint
- `POST /login` - Cognito authentication (public)
- `POST /bedrock` - Protected endpoint (requires Cognito JWT)

## Testing

1. Deploy CDK stack and create test user
2. Set environment variables for backend
3. Start backend server
4. Start frontend dev server
5. Navigate to http://localhost:3000
6. Click "Login" and use: testuser / TestPass123!
7. Access "Test Bedrock" after login

## Security Notes

- ID tokens are used for authentication (contain user claims)
- Access tokens could be used for AWS service calls if needed
- Tokens are validated against Cognito's public JWK endpoint
- Client secret is optional for this demo setup
- All CORS headers are configured for localhost development

## Production Considerations

- Add proper error handling and logging
- Configure proper CORS origins
- Use environment-specific configuration
- Consider token refresh implementation
- Add proper monitoring and health checks
- Use HTTPS in production