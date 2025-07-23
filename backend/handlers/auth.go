package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token        string `json:"token"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	Error        string `json:"error,omitempty"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type RegisterResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func calculateSecretHash(username, clientID, clientSecret string) string {
	message := username + clientID
	key := []byte(clientSecret)
	h := hmac.New(sha256.New, key)
	h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
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
		json.NewEncoder(w).Encode(LoginResponse{Error: "Method not allowed"})
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(LoginResponse{Error: "Invalid request body"})
		return
	}

	// Get Cognito configuration from config
	clientID := "2k9fsa1pd91pnlabuhgt0et77a"
	clientSecret := os.Getenv("COGNITO_CLIENT_SECRET") // Optional

	// Initialize AWS config
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(LoginResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create Cognito client
	cognitoClient := cognitoidentityprovider.NewFromConfig(cfg)

	// Prepare authentication parameters
	authParams := map[string]string{
		"USERNAME": req.Username,
		"PASSWORD": req.Password,
	}

	// Add SECRET_HASH if client secret is provided
	if clientSecret != "" {
		authParams["SECRET_HASH"] = calculateSecretHash(req.Username, clientID, clientSecret)
	}

	// Attempt to authenticate with Cognito
	authInput := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow:       types.AuthFlowTypeUserPasswordAuth,
		ClientId:       &clientID,
		AuthParameters: authParams,
	}

	log.Printf("Attempting Cognito authentication for user: %s", req.Username)
	authResult, err := cognitoClient.InitiateAuth(context.TODO(), authInput)
	if err != nil {
		log.Printf("Cognito authentication failed: %v", err)
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(LoginResponse{Error: "Invalid username or password"})
		return
	}

	log.Printf("Cognito response received. Challenge: %v", authResult.ChallengeName)
	
	// Handle NEW_PASSWORD_REQUIRED challenge
	if authResult.ChallengeName == types.ChallengeNameTypeNewPasswordRequired {
		log.Printf("User requires new password - attempting to set permanent password")
		
		// Use the same password as the new password (for demo purposes)
		challengeParams := map[string]string{
			"USERNAME":     req.Username,
			"NEW_PASSWORD": req.Password,
		}
		
		// Add SECRET_HASH if client secret is provided
		if clientSecret != "" {
			challengeParams["SECRET_HASH"] = calculateSecretHash(req.Username, clientID, clientSecret)
		}
		
		challengeInput := &cognitoidentityprovider.RespondToAuthChallengeInput{
			ChallengeName:      types.ChallengeNameTypeNewPasswordRequired,
			ClientId:          &clientID,
			Session:           authResult.Session,
			ChallengeResponses: challengeParams,
		}
		
		challengeResult, err := cognitoClient.RespondToAuthChallenge(context.TODO(), challengeInput)
		if err != nil {
			log.Printf("Failed to respond to NEW_PASSWORD_REQUIRED challenge: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(LoginResponse{Error: "Failed to set new password"})
			return
		}
		
		// Use the challenge result as the auth result
		authResult = &cognitoidentityprovider.InitiateAuthOutput{
			AuthenticationResult: challengeResult.AuthenticationResult,
		}
		
		log.Printf("Successfully handled NEW_PASSWORD_REQUIRED challenge")
	} else if authResult.ChallengeName != "" {
		log.Printf("Unhandled Cognito challenge: %s", string(authResult.ChallengeName))
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(LoginResponse{Error: fmt.Sprintf("Authentication challenge required: %s", string(authResult.ChallengeName))})
		return
	}

	// Extract tokens from the response
	if authResult.AuthenticationResult == nil {
		log.Printf("No authentication result returned from Cognito - this may indicate a challenge is required")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(LoginResponse{Error: "Authentication failed - user may need password reset"})
		return
	}

	idToken := ""
	accessToken := ""
	refreshToken := ""

	if authResult.AuthenticationResult.IdToken != nil {
		idToken = *authResult.AuthenticationResult.IdToken
	}

	if authResult.AuthenticationResult.AccessToken != nil {
		accessToken = *authResult.AuthenticationResult.AccessToken
	}

	if authResult.AuthenticationResult.RefreshToken != nil {
		refreshToken = *authResult.AuthenticationResult.RefreshToken
	}

	log.Printf("Login successful for user: %s", req.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{
		Token:        idToken,        // Use ID token for authentication
		AccessToken:  accessToken,    // Access token for AWS services
		RefreshToken: refreshToken,   // For token refresh
	})
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Registration request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

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
		json.NewEncoder(w).Encode(RegisterResponse{Error: "Method not allowed"})
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding registration request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{Error: "Invalid request body"})
		return
	}

	// Validate required fields
	if req.Username == "" || req.Password == "" || req.Email == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{Error: "Username, password, and email are required"})
		return
	}

	// Get Cognito configuration
	clientID := "2k9fsa1pd91pnlabuhgt0et77a"
	clientSecret := os.Getenv("COGNITO_CLIENT_SECRET")

	// Initialize AWS config
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Printf("Error loading AWS config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(RegisterResponse{Error: "Failed to load AWS config"})
		return
	}

	// Create Cognito client
	cognitoClient := cognitoidentityprovider.NewFromConfig(cfg)

	// Prepare sign up input
	signUpInput := &cognitoidentityprovider.SignUpInput{
		ClientId: &clientID,
		Username: &req.Username,
		Password: &req.Password,
		UserAttributes: []types.AttributeType{
			{
				Name:  &[]string{"email"}[0],
				Value: &req.Email,
			},
		},
	}

	// Add SECRET_HASH if client secret is provided
	if clientSecret != "" {
		secretHash := calculateSecretHash(req.Username, clientID, clientSecret)
		signUpInput.SecretHash = &secretHash
	}

	log.Printf("Attempting Cognito registration for user: %s", req.Username)
	signUpResult, err := cognitoClient.SignUp(context.TODO(), signUpInput)
	if err != nil {
		log.Printf("Cognito registration failed: %v", err)
		
		// Handle specific Cognito errors
		errorMsg := "Registration failed"
		if err.Error() != "" {
			if err.Error() == "UsernameExistsException" {
				errorMsg = "Username already exists"
			} else if err.Error() == "InvalidPasswordException" {
				errorMsg = "Password does not meet requirements"
			} else if err.Error() == "InvalidParameterException" {
				errorMsg = "Invalid email format"
			}
		}
		
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(RegisterResponse{Error: errorMsg})
		return
	}

	// Check if user confirmation is required
	message := "Registration successful"
	if !signUpResult.UserConfirmed && signUpResult.CodeDeliveryDetails != nil {
		message = "Registration successful. Please check your email for confirmation code."
	}

	log.Printf("Registration successful for user: %s, UserConfirmed: %t", req.Username, signUpResult.UserConfirmed)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RegisterResponse{
		Success: true,
		Message: message,
	})
}