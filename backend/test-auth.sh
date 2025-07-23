#!/bin/bash

echo "1. Testing login endpoint..."
TOKEN=$(curl -X POST http://localhost:8181/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}' \
  -s | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get token"
  exit 1
fi

echo "Token received: ${TOKEN:0:20}..."

echo -e "\n2. Testing bedrock endpoint WITHOUT token..."
curl -X POST http://localhost:8181/bedrock \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}' \
  -s | jq .

echo -e "\n3. Testing bedrock endpoint WITH token..."
curl -X POST http://localhost:8181/bedrock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello, Claude!"}' \
  -s | jq .