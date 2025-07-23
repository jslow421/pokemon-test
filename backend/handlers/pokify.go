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

// MIME type constants
const (
	mimeJPEG = "image/jpeg"
	mimePNG  = "image/png"
)

// Allowed image types
var allowedTypes = map[string]bool{
	mimeJPEG:    true,
	"image/jpg": true,
	mimePNG:     true,
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
	case mimeJPEG, "image/jpg":
		mediaType = mimeJPEG
	case mimePNG:
		mediaType = mimePNG
	default:
		mediaType = mimeJPEG // fallback
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

// generatePokemonCharacter calls AWS Bedrock Nova Canvas to generate a Pokemon character from the uploaded image
func generatePokemonCharacter(base64Image, mediaType string) (string, error) {
	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		return "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create Bedrock client
	client := bedrockruntime.NewFromConfig(cfg)

	// Get Nova Canvas configuration
	bedrockConfig := config.NovaCanvasConfig()

	// Prepare the prompt for Pokemon character generation
	prompt := "Create a friendly Pokémon character inspired by the visual elements in this image. Use official Pokémon art style with: - Bright, vibrant colors from the source image - Cartoon-like features with bold outlines - Cute, approachable design - Fantasy creature characteristics - Clean, family-friendly appearance"

	// Prepare the request for Nova Canvas with conditioning image
	bedrockReq := map[string]interface{}{
		"taskType": "IMAGE_VARIATION",
		"imageVariationParams": map[string]interface{}{
			"text":               prompt,
			"images":             []string{base64Image},
			"similarityStrength": 0.7,
		},
		"imageGenerationConfig": map[string]interface{}{
			"numberOfImages": 1,
			"quality":        "standard",
			"cfgScale":       7.0,
			"height":         1024,
			"width":          1024,
			"seed":           0,
		},
	}

	reqBody, err := json.Marshal(bedrockReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("Calling Bedrock Nova Canvas with image variation request...")

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

	// Extract the generated image from Nova Canvas response
	if images, ok := bedrockResp["images"].([]interface{}); ok && len(images) > 0 {
		if imageData, ok := images[0].(string); ok {
			log.Printf("Successfully generated Pokemon character image with Nova Canvas")
			return imageData, nil
		}
	}

	return "", fmt.Errorf("no image found in Nova Canvas response")
}
