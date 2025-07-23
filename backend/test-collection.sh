#!/bin/bash

echo "Testing Pokemon Collection Endpoint"

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

echo -e "\n2. Save a few Pokemon to test collection..."

echo "Saving Pikachu to favorites..."
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
  -s > /dev/null

echo "Saving Charizard to caught..."
curl -X POST http://localhost:8181/save-pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonName": "charizard",
    "pokemonId": 6,
    "category": "caught",
    "notes": "Caught this fire dragon!",
    "types": ["fire", "flying"],
    "spriteUrl": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png"
  }' \
  -s > /dev/null

echo "Saving Mew to wishlist..."
curl -X POST http://localhost:8181/save-pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pokemonName": "mew",
    "pokemonId": 151,
    "category": "wishlist",
    "notes": "Legendary Pokemon I want to find!",
    "types": ["psychic"],
    "spriteUrl": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/151.png"
  }' \
  -s > /dev/null

echo -e "\n3. Get all Pokemon in collection..."
curl -X GET http://localhost:8181/my-pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.pokemon | length' | xargs -I {} echo "Total Pokemon in collection: {}"

echo -e "\n4. Get Pokemon by category - favorites..."
curl -X GET "http://localhost:8181/my-pokemon?category=favorites" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.pokemon[] | {name: .pokemonName, category: .category, notes: .notes}'

echo -e "\n5. Get Pokemon by category - caught..."
curl -X GET "http://localhost:8181/my-pokemon?category=caught" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.pokemon[] | {name: .pokemonName, category: .category, notes: .notes}'

echo -e "\n6. Get Pokemon by category - wishlist..."
curl -X GET "http://localhost:8181/my-pokemon?category=wishlist" \
  -H "Authorization: Bearer $TOKEN" \
  -s | jq '.pokemon[] | {name: .pokemonName, category: .category, notes: .notes}'

echo -e "\n7. Test without authentication..."
curl -X GET http://localhost:8181/my-pokemon \
  -s | jq '.error'