package main

import (
	"log"
	"net/http"
	"strings"

	"backend/handlers"
	"backend/middleware"
)

func main() {
	// Public endpoints (no auth required)
	http.HandleFunc("/", handlers.HelloHandler)
	http.HandleFunc("/login", handlers.LoginHandler)
	http.HandleFunc("/register", handlers.RegisterHandler)
	
	// Protected endpoints (Cognito auth required)
	http.HandleFunc("/bedrock", middleware.CognitoAuthMiddleware(handlers.BedrockHandler))
	http.HandleFunc("/pokemon/", middleware.CognitoAuthMiddleware(handlers.PokemonHandler))
	http.HandleFunc("/pokemon-identify", middleware.CognitoAuthMiddleware(handlers.PokemonIdentifyHandler))
	http.HandleFunc("/save-pokemon", middleware.CognitoAuthMiddleware(handlers.SavePokemonHandler))
	http.HandleFunc("/update-pokemon/", middleware.CognitoAuthMiddleware(handlers.UpdatePokemonHandler))
	http.HandleFunc("/my-pokemon", middleware.CognitoAuthMiddleware(handlers.GetPokemonCollectionHandler))
	http.HandleFunc("/delete-pokemon/", middleware.CognitoAuthMiddleware(handlers.DeletePokemonHandler))
	http.HandleFunc("/pokify", middleware.CognitoAuthMiddleware(handlers.PokifyHandler))
	http.HandleFunc("/start-battle", middleware.CognitoAuthMiddleware(handlers.StartBattleHandler))
	http.HandleFunc("/battle/", middleware.CognitoAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/move") {
			handlers.MakeMoveHandler(w, r)
		} else {
			handlers.GetBattleHandler(w, r)
		}
	}))

	log.Println("Server starting on port 8181...")
	log.Println("Using hardcoded Cognito configuration for demo")
	log.Println("Available endpoints:")
	log.Println("  GET /pokemon/{id_or_name} - Get Pokemon data (authenticated)")
	log.Println("  POST /pokemon-identify - Identify Pokemon from image (authenticated)")
	log.Println("  POST /save-pokemon - Save Pokemon to collection (authenticated)")
	log.Println("  PUT /update-pokemon/{entryId} - Update Pokemon entry (authenticated)")
	log.Println("  GET /my-pokemon?category={category} - Get saved Pokemon (authenticated)")
	log.Println("  DELETE /delete-pokemon/{entryId} - Delete Pokemon from collection (authenticated)")
	log.Println("  POST /pokify - Transform photo into Pokemon character (authenticated)")
	log.Println("  POST /start-battle - Start a new Pokemon battle (authenticated)")
	log.Println("  GET /battle/{battleId} - Get battle state (authenticated)")
	log.Println("  POST /battle/{battleId}/move - Make a move in battle (authenticated)")
	if err := http.ListenAndServe(":8181", nil); err != nil {
		log.Fatal(err)
	}
}