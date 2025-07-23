package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"backend/config"
	"backend/middleware"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const (
	PokeAPIBaseURL = "https://pokeapi.co/api/v2"
	RequestTimeout = 10 * time.Second
	TableName      = "pokemon-entries"
	MaxImageSize   = 5 * 1024 * 1024 // 5MB
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

type GetPokemonCollectionResponse struct {
	Pokemon []PokemonEntry `json:"pokemon,omitempty"`
	Error   string         `json:"error,omitempty"`
}

type PokemonEntry struct {
	UserId       string    `json:"userId" dynamodbav:"userId"`
	EntryId      string    `json:"entryId" dynamodbav:"entryId"`
	PokemonName  string    `json:"pokemonName" dynamodbav:"pokemonName"`
	PokemonId    int       `json:"pokemonId" dynamodbav:"pokemonId"`
	Category     string    `json:"category" dynamodbav:"category"`
	Notes        string    `json:"notes" dynamodbav:"notes"`
	Types        []string  `json:"types" dynamodbav:"types"`
	SpriteUrl    string    `json:"spriteUrl" dynamodbav:"spriteUrl"`
	UserCategory string    `json:"userCategory" dynamodbav:"userCategory"`
	CreatedAt    string    `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt    string    `json:"updatedAt" dynamodbav:"updatedAt"`
}

type PokemonIdentifyResponse struct {
	PokemonName string          `json:"pokemon_name"`
	Confidence  float64         `json:"confidence"`
	PokeAPIData json.RawMessage `json:"pokeapi_data,omitempty"`
	Error       string          `json:"error,omitempty"`
}

type BedrockIdentificationResult struct {
	PokemonName string  `json:"pokemon_name"`
	Confidence  float64 `json:"confidence"`
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
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
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

func GetPokemonCollectionHandler(w http.ResponseWriter, r *http.Request) {
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
		json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context (set by auth middleware)
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Authentication required"})
		return
	}

	// Get optional category filter from query parameters
	category := r.URL.Query().Get("category")

	log.Printf("User %s requesting Pokemon collection, category filter: %s", user.Username, category)

	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create DynamoDB client
	dynamoClient := dynamodb.NewFromConfig(cfg)
	tableName := TableName

	var pokemon []PokemonEntry

	if category != "" {
		// Query by category using GSI
		userCategory := fmt.Sprintf("USER#%s#CATEGORY#%s", user.Sub, category)
		
		queryInput := &dynamodb.QueryInput{
			TableName:              &tableName,
			IndexName:              stringPtr("CategoryIndex"),
			KeyConditionExpression: stringPtr("userCategory = :userCategory"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":userCategory": &types.AttributeValueMemberS{Value: userCategory},
			},
			ScanIndexForward: boolPtr(false), // Sort by createdAt descending (newest first)
		}

		result, err := dynamoClient.Query(context.TODO(), queryInput)
		if err != nil {
			log.Printf("Error querying DynamoDB by category: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Failed to query Pokemon collection"})
			return
		}

		// Unmarshal results
		err = attributevalue.UnmarshalListOfMaps(result.Items, &pokemon)
		if err != nil {
			log.Printf("Error unmarshaling DynamoDB items: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Failed to process Pokemon collection"})
			return
		}
	} else {
		// Query all Pokemon for user
		queryInput := &dynamodb.QueryInput{
			TableName:              &tableName,
			KeyConditionExpression: stringPtr("userId = :userId"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":userId": &types.AttributeValueMemberS{Value: user.Sub},
			},
			ScanIndexForward: boolPtr(false), // Sort by entryId descending (newest first)
		}

		result, err := dynamoClient.Query(context.TODO(), queryInput)
		if err != nil {
			log.Printf("Error querying DynamoDB: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Failed to query Pokemon collection"})
			return
		}

		// Unmarshal results
		err = attributevalue.UnmarshalListOfMaps(result.Items, &pokemon)
		if err != nil {
			log.Printf("Error unmarshaling DynamoDB items: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(GetPokemonCollectionResponse{Error: "Failed to process Pokemon collection"})
			return
		}
	}

	log.Printf("Successfully retrieved %d Pokemon for user: %s", len(pokemon), user.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GetPokemonCollectionResponse{
		Pokemon: pokemon,
	})
}

func DeletePokemonHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodDelete {
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

	// Extract entryId from URL path
	// Expected format: /delete-pokemon/{entryId}
	path := r.URL.Path
	if len(path) < len("/delete-pokemon/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Entry ID required"})
		return
	}

	entryId := path[len("/delete-pokemon/"):]
	if entryId == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Entry ID required"})
		return
	}

	log.Printf("User %s deleting Pokemon entry: %s", user.Username, entryId)

	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create DynamoDB client
	dynamoClient := dynamodb.NewFromConfig(cfg)
	tableName := TableName

	// Delete the item from DynamoDB
	// Using userId and entryId as the composite key
	_, err = dynamoClient.DeleteItem(context.TODO(), &dynamodb.DeleteItemInput{
		TableName: &tableName,
		Key: map[string]types.AttributeValue{
			"userId":  &types.AttributeValueMemberS{Value: user.Sub},
			"entryId": &types.AttributeValueMemberS{Value: entryId},
		},
	})

	if err != nil {
		log.Printf("Error deleting from DynamoDB: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SavePokemonResponse{Error: "Failed to delete Pokemon entry"})
		return
	}

	log.Printf("Successfully deleted Pokemon entry: %s for user: %s", entryId, user.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SavePokemonResponse{
		Success: true,
	})
}

func PokemonIdentifyHandler(w http.ResponseWriter, r *http.Request) {
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
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context (set by auth middleware)
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Authentication required"})
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(MaxImageSize)
	if err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Invalid form data"})
		return
	}

	// Get the image file
	file, header, err := r.FormFile("image")
	if err != nil {
		log.Printf("Error getting form file: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Image file required"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > MaxImageSize {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Image too large (max 5MB)"})
		return
	}

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "File must be an image"})
		return
	}

	// Read image data
	imageData, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading image data: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Failed to read image"})
		return
	}

	log.Printf("User %s uploading image for identification, size: %d bytes", user.Username, len(imageData))

	// Identify Pokemon using Bedrock
	pokemonName, confidence, err := identifyPokemon(imageData)
	if err != nil {
		log.Printf("Error identifying Pokemon: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonIdentifyResponse{Error: "Failed to identify Pokemon"})
		return
	}

	response := PokemonIdentifyResponse{
		PokemonName: pokemonName,
		Confidence:  confidence,
	}

	// If confidence is high enough and we have a valid Pokemon name, fetch PokeAPI data
	if confidence > 0.5 && pokemonName != "unknown" {
		pokeAPIData, err := fetchPokemonData(pokemonName)
		if err != nil {
			log.Printf("Error fetching PokeAPI data for %s: %v", pokemonName, err)
			// Don't fail the request, just return without PokeAPI data
		} else {
			response.PokeAPIData = json.RawMessage(pokeAPIData)
		}
	}

	log.Printf("Successfully identified Pokemon: %s (confidence: %.2f)", pokemonName, confidence)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func identifyPokemon(imageBytes []byte) (string, float64, error) {
	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		return "", 0, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create Bedrock client
	client := bedrockruntime.NewFromConfig(cfg)

	// Convert image to base64
	imageBase64 := base64.StdEncoding.EncodeToString(imageBytes)

	// Get Bedrock configuration
	bedrockConfig := config.DefaultBedrockConfig()
	
	// Prepare the request for Claude Sonnet with vision
	prompt := `Analyze this image and identify the Pokémon. Respond with JSON only:

{
  "pokemon_name": "exact_name_lowercase",
  "confidence": 0.0-1.0
}

Rules:
- Use exact PokéAPI names (e.g., "pikachu", "charizard")
- If unsure or no Pokémon visible, use "unknown" and confidence < 0.5
- Consider regional forms (e.g., "alolan-raichu")`

	bedrockReq := map[string]interface{}{
		"anthropic_version": bedrockConfig.AnthropicVersion,
		"max_tokens":        bedrockConfig.MaxTokens,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image",
						"source": map[string]interface{}{
							"type":       "base64",
							"media_type": "image/jpeg",
							"data":       imageBase64,
						},
					},
				},
			},
		},
	}

	reqBody, err := json.Marshal(bedrockReq)
	if err != nil {
		return "", 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Call Bedrock
	output, err := client.InvokeModel(context.TODO(), &bedrockruntime.InvokeModelInput{
		Body:        reqBody,
		ModelId:     stringPtr(bedrockConfig.ModelID),
		ContentType: stringPtr(bedrockConfig.ContentType),
	})

	if err != nil {
		return "", 0, fmt.Errorf("failed to call Bedrock: %w", err)
	}

	// Parse the response
	var bedrockResp map[string]interface{}
	if err := json.Unmarshal(output.Body, &bedrockResp); err != nil {
		return "", 0, fmt.Errorf("failed to parse Bedrock response: %w", err)
	}

	// Extract the text response
	var responseText string
	if content, ok := bedrockResp["content"].([]interface{}); ok && len(content) > 0 {
		if firstContent, ok := content[0].(map[string]interface{}); ok {
			if text, ok := firstContent["text"].(string); ok {
				responseText = text
			}
		}
	}

	if responseText == "" {
		return "unknown", 0.0, nil
	}

	// Parse the JSON response from Claude
	var result BedrockIdentificationResult
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		log.Printf("Failed to parse Claude response as JSON: %v, response: %s", err, responseText)
		return "unknown", 0.0, nil
	}

	return result.PokemonName, result.Confidence, nil
}

func fetchPokemonData(pokemonName string) ([]byte, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	// Build PokeAPI URL
	pokeAPIURL := fmt.Sprintf("%s/pokemon/%s", PokeAPIBaseURL, pokemonName)

	// Make request to PokeAPI
	resp, err := client.Get(pokeAPIURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from PokeAPI: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("PokeAPI returned status %d", resp.StatusCode)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read PokeAPI response: %w", err)
	}

	return body, nil
}

// Helper functions
func boolPtr(b bool) *bool {
	return &b
}

