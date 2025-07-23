package main

import (
	"log"
	"net/http"

	"backend/handlers"
	"backend/middleware"
)

func main() {
	// Public endpoints (no auth required)
	http.HandleFunc("/", handlers.HelloHandler)
	http.HandleFunc("/login", handlers.LoginHandler)
	
	// Protected endpoints (Cognito auth required)
	http.HandleFunc("/bedrock", middleware.CognitoAuthMiddleware(handlers.BedrockHandler))
	http.HandleFunc("/pokemon-species/", middleware.CognitoAuthMiddleware(handlers.PokemonSpeciesHandler))

	log.Println("Server starting on port 8181...")
	log.Println("Using hardcoded Cognito configuration for demo")
	log.Println("Available endpoints:")
	log.Println("  GET /pokemon-species/{id_or_name} - Get Pokemon species data (authenticated)")
	if err := http.ListenAndServe(":8181", nil); err != nil {
		log.Fatal(err)
	}
}