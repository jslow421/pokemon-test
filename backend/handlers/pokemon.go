package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"backend/middleware"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

const (
	PokeAPIBaseURL = "https://pokeapi.co/api/v2"
	RequestTimeout = 10 * time.Second
	TableName      = "pokemon-entries"
)

type PokemonResponse struct {
	Data  json.RawMessage `json:"data,omitempty"`
	Error string          `json:"error,omitempty"`
}

type SavePokemonRequest struct {
	PokemonName string   `json:"pokemonName"`
	PokemonId   int      `json:"pokemonId"`
	Category    string   `json:"category"`
	Notes       string   `json:"notes"`
	Types       []string `json:"types"`
	SpriteUrl   string   `json:"spriteUrl"`
}

type SavePokemonResponse struct {
	Success bool   `json:"success"`
	EntryId string `json:"entryId,omitempty"`
	Error   string `json:"error,omitempty"`
}

type PokemonEntry struct {
	UserId       string    `dynamodbav:"userId"`
	EntryId      string    `dynamodbav:"entryId"`
	PokemonName  string    `dynamodbav:"pokemonName"`
	PokemonId    int       `dynamodbav:"pokemonId"`
	Category     string    `dynamodbav:"category"`
	Notes        string    `dynamodbav:"notes"`
	Types        []string  `dynamodbav:"types"`
	SpriteUrl    string    `dynamodbav:"spriteUrl"`
	UserCategory string    `dynamodbav:"userCategory"`
	CreatedAt    string    `dynamodbav:"createdAt"`
	UpdatedAt    string    `dynamodbav:"updatedAt"`
}

func PokemonHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context (set by auth middleware)
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Authentication required"})
		return
	}

	// Extract Pokemon ID or name from URL path
	// Expected format: /pokemon/{id_or_name}
	path := r.URL.Path
	if len(path) < len("/pokemon/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Pokemon ID or name required"})
		return
	}

	pokemonIdentifier := path[len("/pokemon/"):]
	if pokemonIdentifier == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Pokemon ID or name required"})
		return
	}

	log.Printf("User %s requesting Pokemon: %s", user.Username, pokemonIdentifier)

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	// Build PokeAPI URL
	pokeAPIURL := fmt.Sprintf("%s/pokemon/%s", PokeAPIBaseURL, pokemonIdentifier)
	log.Printf("Proxying request to: %s", pokeAPIURL)

	// Make request to PokeAPI
	resp, err := client.Get(pokeAPIURL)
	if err != nil {
		log.Printf("Error fetching from PokeAPI: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Failed to fetch Pokemon data"})
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading PokeAPI response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Failed to read Pokemon data"})
		return
	}

	// Handle different HTTP status codes from PokeAPI
	if resp.StatusCode == http.StatusNotFound {
		log.Printf("Pokemon not found: %s", pokemonIdentifier)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "Pokemon not found"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("PokeAPI returned status %d for %s", resp.StatusCode, pokemonIdentifier)
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(PokemonResponse{Error: "External API error"})
		return
	}

	// Return the Pokemon data
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(PokemonResponse{Data: json.RawMessage(body)})
	
	log.Printf("Successfully returned Pokemon data for: %s", pokemonIdentifier)
}

func SavePokemonHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context (set by auth middleware)
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Authentication required"})
		return
	}

	var req SavePokemonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Invalid request body"})
		return
	}

	// Validate required fields
	if req.PokemonName == "" || req.Category == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Pokemon name and category are required"})
		return
	}

	// Validate category (using common Pokemon categories)
	validCategories := map[string]bool{
		"favorites": true,
		"caught":    true,
		"wishlist":  true,
	}
	if !validCategories[req.Category] {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Invalid category. Must be: favorites, caught, or wishlist"})
		return
	}

	log.Printf("User %s saving Pokemon: %s in category: %s", user.Username, req.PokemonName, req.Category)

	// Initialize AWS config
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create DynamoDB client
	dynamoClient := dynamodb.NewFromConfig(cfg)

	// Generate unique entry ID
	now := time.Now()
	entryId := fmt.Sprintf("%s_%d", req.PokemonName, now.Unix())
	
	// Create Pokemon entry
	entry := PokemonEntry{
		UserId:       user.Sub, // Use Cognito user's sub as userId
		EntryId:      entryId,
		PokemonName:  req.PokemonName,
		PokemonId:    req.PokemonId,
		Category:     req.Category,
		Notes:        req.Notes,
		Types:        req.Types,
		SpriteUrl:    req.SpriteUrl,
		UserCategory: fmt.Sprintf("USER#%s#CATEGORY#%s", user.Sub, req.Category),
		CreatedAt:    now.Format(time.RFC3339),
		UpdatedAt:    now.Format(time.RFC3339),
	}

	// Convert to DynamoDB attribute values
	item, err := attributevalue.MarshalMap(entry)
	if err != nil {
		log.Printf("Error marshaling item: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Failed to prepare item"})
		return
	}

	// Save to DynamoDB
	tableName := TableName
	_, err = dynamoClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: &tableName,
		Item:      item,
	})

	if err != nil {
		log.Printf("Error saving to DynamoDB: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Failed to save Pokemon entry"})
		return
	}

	log.Printf("Successfully saved Pokemon entry: %s for user: %s", entryId, user.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SavePokemonResponse{
		Success: true,
		EntryId: entryId,
	})
}