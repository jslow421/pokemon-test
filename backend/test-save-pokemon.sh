#!/bin/bash

echo "Testing Save Pokemon Endpoint"

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

echo -e "\n2. Test save Pokemon endpoint..."
curl -X POST http://localhost:8181/save-pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonName": "pikachu",
    "pokemonId": 25,
    "category": "favorites",
    "notes": "My favorite electric Pokemon!",
    "types": ["electric"],
    "spriteUrl": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png"
  }' \
  -s | jq .

echo -e "\n3. Test save Pokemon with invalid category..."
curl -X POST http://localhost:8181/save-pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonName": "charizard",
    "pokemonId": 6,
    "category": "invalid",
    "notes": "Should fail",
    "types": ["fire", "flying"],
    "spriteUrl": "https://example.com/charizard.png"
  }' \
  -s | jq .

echo -e "\n4. Test save Pokemon without authentication..."
curl -X POST http://localhost:8181/save-pokemon \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonName": "bulbasaur",
    "pokemonId": 1,
    "category": "caught",
    "notes": "Should require auth",
    "types": ["grass", "poison"],
    "spriteUrl": "https://example.com/bulbasaur.png"
  }' \
  -s | jq .