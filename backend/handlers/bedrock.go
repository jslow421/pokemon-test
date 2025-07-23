package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"backend/config"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

type BedrockRequest struct {
	Message string `json:"message"`
}

type BedrockResponse struct {
	Response string `json:"response"`
	Error    string `json:"error,omitempty"`
}

func BedrockHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Method not allowed"})
		return
	}

	var req BedrockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Invalid request body"})
		return
	}

	log.Printf("Received message: %s", req.Message)

	// Initialize AWS config
	cfg, err := awsconfig.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create Bedrock client
	client := bedrockruntime.NewFromConfig(cfg)

	// Get Bedrock configuration
	bedrockConfig := config.DefaultBedrockConfig()
	
	// Prepare the request for Claude Sonnet
	bedrockReq := map[string]interface{}{
		"anthropic_version": bedrockConfig.AnthropicVersion,
		"max_tokens":        bedrockConfig.MaxTokens,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": req.Message,
			},
		},
	}

	reqBody, err := json.Marshal(bedrockReq)
	if err != nil {
		log.Printf("Error marshaling request: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Failed to prepare request"})
		return
	}

	// Call Bedrock with on-demand model access
	output, err := client.InvokeModel(context.TODO(), &bedrockruntime.InvokeModelInput{
		Body:        reqBody,
		ModelId:     stringPtr(bedrockConfig.ModelID),
		ContentType: stringPtr(bedrockConfig.ContentType),
	})

	if err != nil {
		log.Printf("Error calling Bedrock: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Failed to call Bedrock"})
		return
	}

	// Parse the response
	var bedrockResp map[string]interface{}
	if err := json.Unmarshal(output.Body, &bedrockResp); err != nil {
		log.Printf("Error parsing Bedrock response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(BedrockResponse{Error: "Failed to parse response"})
		return
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(BedrockResponse{Response: responseText})
	log.Printf("Response sent: 200 OK")
}

