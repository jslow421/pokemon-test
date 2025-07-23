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
	prompt := "Cute CARTOON character in Pokemon art style of a trainer with vibrant colors and friendly design. The CARTOON character should be unique. This is a demonstration."

	// Prepare the request for Nova Canvas with conditioning image
	bedrockReq := map[string]interface{}{
		"taskType": "TEXT_IMAGE",
		"textToImageParams": map[string]interface{}{
			//"text":           "Cute trainer character with vibrant colors and friendly design based on this reference",
			"text":           prompt,
			"conditionImage": base64Image,
			"controlMode":    "CANNY_EDGE",
			"style":          "FLAT_VECTOR_ILLUSTRATION", // Force cartoon style!
			"negativeText":   "photorealistic, realistic, photograph, detailed skin, realistic lighting, lifelike, realistic hair, detailed textures",
		},
		"imageGenerationConfig": map[string]interface{}{
			"numberOfImages": 1,
			"height":         1024,
			"width":          1024,
			"cfgScale":       10.0,
		},
	}

	reqBody, err := json.Marshal(bedrockReq)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("Calling Bedrock Nova Canvas with request - Model: %s, Body size: %d bytes", bedrockConfig.ModelID, len(reqBody))
	log.Printf("Request payload structure: taskType=%s, prompt length=%d, image data length=%d",
		bedrockReq["taskType"], len(prompt), len(base64Image))

	// Call Bedrock
	output, err := client.InvokeModel(context.TODO(), &bedrockruntime.InvokeModelInput{
		Body:        reqBody,
		ModelId:     stringPtr(bedrockConfig.ModelID),
		ContentType: stringPtr(bedrockConfig.ContentType),
	})

	if err != nil {
		log.Printf("Bedrock API call failed: %v", err)
		return "", fmt.Errorf("failed to call Bedrock: %w", err)
	}

	log.Printf("Bedrock API call successful - Response body size: %d bytes", len(output.Body))

	// Parse the response
	var bedrockResp map[string]interface{}
	if err := json.Unmarshal(output.Body, &bedrockResp); err != nil {
		log.Printf("Failed to parse Bedrock response. Raw response: %s", string(output.Body))
		return "", fmt.Errorf("failed to parse Bedrock response: %w", err)
	}

	// Log the full response structure for debugging
	//responseJSON, _ := json.MarshalIndent(bedrockResp, "", "  ")
	//log.Printf("Nova Canvas response structure: %s", string(responseJSON))

	// Extract the generated image from Nova Canvas response
	if images, ok := bedrockResp["images"].([]interface{}); ok {
		log.Printf("Found 'images' array with %d items", len(images))
		if len(images) > 0 {
			if imageData, ok := images[0].(string); ok {
				log.Printf("Successfully extracted image data (length: %d characters)", len(imageData))
				return imageData, nil
			} else {
				log.Printf("First image item is not a string, type: %T, value: %v", images[0], images[0])
			}
		} else {
			log.Printf("Images array is empty")
		}
	} else {
		log.Printf("No 'images' key found in response or it's not an array")
		// Check what keys are actually in the response
		keys := make([]string, 0, len(bedrockResp))
		for k := range bedrockResp {
			keys = append(keys, k)
		}
		log.Printf("Available response keys: %v", keys)
	}

	// Check for common error fields
	if errorMsg, ok := bedrockResp["error"].(string); ok {
		log.Printf("Nova Canvas returned error: %s", errorMsg)
		return "", fmt.Errorf("Nova Canvas error: %s", errorMsg)
	}
	if message, ok := bedrockResp["message"].(string); ok {
		log.Printf("Nova Canvas returned message: %s", message)
	}

	return "", fmt.Errorf("no image found in Nova Canvas response - check logs for response structure")
}
