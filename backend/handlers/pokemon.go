package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"backend/middleware"
)

const (
	PokeAPIBaseURL = "https://pokeapi.co/api/v2"
	RequestTimeout = 10 * time.Second
)

type PokemonSpeciesResponse struct {
	Data  json.RawMessage `json:"data,omitempty"`
	Error string          `json:"error,omitempty"`
}

func PokemonSpeciesHandler(w http.ResponseWriter, r *http.Request) {
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
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context (set by auth middleware)
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Authentication required"})
		return
	}

	// Extract Pokemon ID or name from URL path
	// Expected format: /pokemon-species/{id_or_name}
	path := r.URL.Path
	if len(path) < len("/pokemon-species/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Pokemon ID or name required"})
		return
	}

	pokemonIdentifier := path[len("/pokemon-species/"):]
	if pokemonIdentifier == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Pokemon ID or name required"})
		return
	}

	log.Printf("User %s requesting Pokemon species: %s", user.Username, pokemonIdentifier)

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	// Build PokeAPI URL
	pokeAPIURL := fmt.Sprintf("%s/pokemon-species/%s", PokeAPIBaseURL, pokemonIdentifier)
	log.Printf("Proxying request to: %s", pokeAPIURL)

	// Make request to PokeAPI
	resp, err := client.Get(pokeAPIURL)
	if err != nil {
		log.Printf("Error fetching from PokeAPI: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Failed to fetch Pokemon data"})
		return
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading PokeAPI response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Failed to read Pokemon data"})
		return
	}

	// Handle different HTTP status codes from PokeAPI
	if resp.StatusCode == http.StatusNotFound {
		log.Printf("Pokemon not found: %s", pokemonIdentifier)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "Pokemon not found"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("PokeAPI returned status %d for %s", resp.StatusCode, pokemonIdentifier)
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(PokemonSpeciesResponse{Error: "External API error"})
		return
	}

	// Return the Pokemon data
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(PokemonSpeciesResponse{Data: json.RawMessage(body)})
	
	log.Printf("Successfully returned Pokemon species data for: %s", pokemonIdentifier)
}