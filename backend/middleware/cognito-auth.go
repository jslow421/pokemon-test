package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

type CognitoContextKey string

const CognitoUserContextKey CognitoContextKey = "cognito_user"

type CognitoUser struct {
	Sub      string `json:"sub"`
	Username string `json:"cognito:username"`
	Email    string `json:"email"`
}

func CognitoAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Hardcoded User Pool ID for demo
		userPoolID := "us-east-1_vbKOhRy1X"

		// Get token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			log.Printf("Missing Authorization header")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Missing authorization header"})
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			log.Printf("Invalid Authorization header format")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid authorization header format"})
			return
		}

		tokenString := parts[1]

		// Hardcoded region for demo
		region := "us-east-1"

		// Construct the JWK URL for the Cognito User Pool
		jwkURL := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json", region, userPoolID)

		// Fetch the JWK set
		keySet, err := jwk.Fetch(context.Background(), jwkURL)
		if err != nil {
			log.Printf("Failed to fetch JWK set: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to validate token"})
			return
		}

		// Parse and validate the token
		token, err := jwt.Parse([]byte(tokenString), jwt.WithKeySet(keySet))
		if err != nil {
			log.Printf("Failed to parse/validate token: %v", err)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token"})
			return
		}

		// Extract user information from token claims
		claims := token.PrivateClaims()
		
		user := CognitoUser{
			Sub: token.Subject(),
		}

		if username, ok := claims["cognito:username"].(string); ok {
			user.Username = username
		}

		if email, ok := claims["email"].(string); ok {
			user.Email = email
		}

		// Add user to request context
		ctx := context.WithValue(r.Context(), CognitoUserContextKey, user)
		r = r.WithContext(ctx)

		// Call next handler
		next(w, r)
	}
}