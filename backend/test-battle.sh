#!/bin/bash

echo "Testing battle system endpoints..."
echo "Note: Battle data is stored in memory only - no DynamoDB required!"

# Start battle (replace with actual JWT token)
echo "Starting a battle..."
curl -X POST http://localhost:8181/start-battle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"playerPokemonId": 25}' \
  | jq '.'

echo -e "\n\nNote: Replace YOUR_JWT_TOKEN_HERE with a valid JWT token to test the endpoints"
echo "You can get a token by logging in through the frontend first"
echo "Battles are cleaned up automatically after 1 hour to prevent memory leaks"