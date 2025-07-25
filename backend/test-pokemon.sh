#!/bin/bash

echo "Testing Pokemon Endpoint"

echo "1. Login to get JWT token..."
RESPONSE=$(curl -X POST http://localhost:8181/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123!"}' \
  -s)

TOKEN=$(echo $RESPONSE | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get token. Response:"
  echo $RESPONSE
  exit 1
fi

echo "Token received: ${TOKEN:0:20}..."

echo -e "\n2. Test Pokemon endpoint with Pikachu..."
curl -X GET http://localhost:8181/pokemon/pikachu \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.data.name // .error'

echo -e "\n3. Test Pokemon endpoint with Charizard..."
curl -X GET http://localhost:8181/pokemon/charizard \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.data.name // .error'

echo -e "\n4. Test with invalid Pokemon..."
curl -X GET http://localhost:8181/pokemon/invalidpokemon \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.error // .data'

echo -e "\n5. Test without authentication..."
curl -X GET http://localhost:8181/pokemon/pikachu \
  -s | jq '.error // .message'