package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"backend/config"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

// PokifyResponse represents the response structure for the pokify endpoint
type PokifyResponse struct {
	PokemonImage string `json:"pokemon_image,omitempty"` // Base64 encoded image
	Error        string `json:"error,omitempty"`
}

// Maximum file size (5MB)
const maxFileSize = 5 * 1024 * 1024

// Allowed image types
var allowedTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
}

// PokifyHandler handles image upload and Pokemon character generation
func PokifyHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Pokify request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight requests
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only allow POST requests
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "Method not allowed"})
		return
	}

	// Parse multipart form (32MB max memory)
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "Failed to parse form data"})
		return
	}

	// Get the uploaded file
	file, header, err := r.FormFile("image")
	if err != nil {
		log.Printf("Error getting uploaded file: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "No image file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > maxFileSize {
		log.Printf("File too large: %d bytes", header.Size)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "File size too large (max 5MB)"})
		return
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading file: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "Failed to read uploaded file"})
		return
	}

	// Detect content type
	contentType := http.DetectContentType(fileBytes)

	// Validate file type
	if !allowedTypes[contentType] {
		log.Printf("Invalid file type: %s", contentType)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "Invalid file type. Only JPEG and PNG files are allowed"})
		return
	}

	// Convert image to base64 for Bedrock
	base64Image := base64.StdEncoding.EncodeToString(fileBytes)

	// Determine media type for Bedrock
	var mediaType string
	switch contentType {
	case "image/jpeg", "image/jpg":
		mediaType = "image/jpeg"
	case "image/png":
		mediaType = "image/png"
	default:
		mediaType = "image/jpeg" // fallback
	}

	log.Printf("Processing image: %s, size: %d bytes", contentType, len(fileBytes))

	// Generate Pokemon character using Bedrock
	pokemonImage, err := generatePokemonCharacter(base64Image, mediaType)
	if err != nil {
		log.Printf("Error generating Pokemon character: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokifyResponse{Error: "Failed to generate Pokemon character"})
		return
	}

	// Return the generated Pokemon image
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PokifyResponse{PokemonImage: pokemonImage})
	log.Printf("Pokify response sent: 200 OK")
}

// generatePokemonCharacter calls AWS Bedrock to generate a Pokemon character from the uploaded image
func generatePokemonCharacter(base64Image, mediaType string) (string, error) {
	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create Bedrock client
	client := bedrockruntime.NewFromConfig(cfg)

	// Get Bedrock configuration
	bedrockConfig := config.DefaultBedrockConfig()

	// Updated max tokens for image generation
	bedrockConfig.MaxTokens = 4000

	// Prepare the prompt for Pokemon character generation
	prompt := `You are an expert Pokémon character designer. I'm providing you with an image. Please create a new Pokémon character that is clearly inspired by this image while maintaining the official Pokémon art style.

Requirements:
- The Pokémon should be recognizably inspired by the thing in the image (similar colors, distinctive features, overall aesthetic)
- Use the official Pokémon art style - clean, vibrant, cartoon-like with bold outlines
- Create an original Pokémon design, not an existing one
- The character should look friendly and approachable like most Pokémon
- Include some unique characteristics that reflect the thing's appearance
- Generate at a reasonable resolution (not too large for web display)
- Make it clear this is a Pokémon-style creature, not just a cartoon version of the thing

Please generate the Pokémon character image inspired by the uploaded photo.`

	// Prepare the request for Claude Sonnet with image input
	bedrockReq := map[string]interface{}{
		"anthropic_version": bedrockConfig.AnthropicVersion,
		"max_tokens":        bedrockConfig.MaxTokens,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]interface{}{
							"type":       "base64",
							"media_type": mediaType,
							"data":       base64Image,
						},
					},
					{
						"type": "text",
						"text": prompt,
					},
				},
			},
		},
	}

	reqBody, err := json.Marshal(bedrockReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("Calling Bedrock with image generation request...")

	// Call Bedrock
	output, err := client.InvokeModel(context.TODO(), &bedrockruntime.InvokeModelInput{
		Body:        reqBody,
		ModelId:     stringPtr(bedrockConfig.ModelID),
		ContentType: stringPtr(bedrockConfig.ContentType),
	})

	if err != nil {
		return "", fmt.Errorf("failed to call Bedrock: %w", err)
	}

	// Parse the response
	var bedrockResp map[string]interface{}
	if err := json.Unmarshal(output.Body, &bedrockResp); err != nil {
		return "", fmt.Errorf("failed to parse Bedrock response: %w", err)
	}

	// Extract the generated image
	if content, ok := bedrockResp["content"].([]interface{}); ok && len(content) > 0 {
		for _, item := range content {
			if contentItem, ok := item.(map[string]interface{}); ok {
				if contentType, ok := contentItem["type"].(string); ok && contentType == "image" {
					if source, ok := contentItem["source"].(map[string]interface{}); ok {
						if imageData, ok := source["data"].(string); ok {
							log.Printf("Successfully generated Pokemon character image")
							return imageData, nil
						}
					}
				}
			}
		}
	}

	// If no image found in response, check for text response as fallback
	if content, ok := bedrockResp["content"].([]interface{}); ok && len(content) > 0 {
		if firstContent, ok := content[0].(map[string]interface{}); ok {
			if text, ok := firstContent["text"].(string); ok {
				log.Printf("Bedrock returned text response instead of image: %s", text)
				return "", fmt.Errorf("Bedrock did not generate an image. Response: %s", text)
			}
		}
	}

	return "", fmt.Errorf("no image found in Bedrock response")
}
