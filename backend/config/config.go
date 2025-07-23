package config

import "os"

// JWTSecret is the secret key for JWT signing
// In production, this should be loaded from environment variables
var JWTSecret = []byte("your-secret-key-change-this-in-production")

// GetEnvOrDefault returns the environment variable value or a default value
func GetEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// BedrockConfig contains AWS Bedrock configuration
type BedrockConfig struct {
	ModelID          string
	AnthropicVersion string
	MaxTokens        int
	ContentType      string
}

// DefaultBedrockConfig returns the default Bedrock configuration for text processing (Sonnet 4)
func DefaultBedrockConfig() BedrockConfig {
	return BedrockConfig{
		ModelID:          "us.anthropic.claude-sonnet-4-20250514-v1:0",
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        1000,
		ContentType:      "application/json",
	}
}

// TitanImageConfig returns the Bedrock configuration for Titan Image Generator
func TitanImageConfig() BedrockConfig {
	return BedrockConfig{
		ModelID:          "amazon.titan-image-generator-v2:0",
		AnthropicVersion: "", // Not used by Titan
		MaxTokens:        0,  // Not used by Titan
		ContentType:      "application/json",
	}
}
