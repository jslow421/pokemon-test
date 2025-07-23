package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"backend/middleware"
)

// In-memory battle storage
var (
	battleStore = make(map[string]*BattleState)
	battleMutex = &sync.RWMutex{}
)

// cleanupOldBattles removes battles older than 1 hour from memory
func cleanupOldBattles() {
	battleMutex.Lock()
	defer battleMutex.Unlock()
	
	now := time.Now()
	cutoff := now.Add(-1 * time.Hour)
	
	for battleId, battle := range battleStore {
		createdAt, err := time.Parse(time.RFC3339, battle.CreatedAt)
		if err != nil {
			log.Printf("Error parsing battle creation time: %v", err)
			continue
		}
		
		if createdAt.Before(cutoff) {
			delete(battleStore, battleId)
			log.Printf("Cleaned up old battle: %s", battleId)
		}
	}
}

// Start cleanup routine (called once when server starts)
func init() {
	go func() {
		ticker := time.NewTicker(30 * time.Minute) // Clean up every 30 minutes
		defer ticker.Stop()
		
		for range ticker.C {
			cleanupOldBattles()
		}
	}()
}

type BattleState struct {
	BattleId       string    `json:"battleId"`
	UserId         string    `json:"userId"`
	PlayerPokemon  BattlePokemon `json:"playerPokemon"`
	ComputerPokemon BattlePokemon `json:"computerPokemon"`
	CurrentTurn    string    `json:"currentTurn"` // "player" or "computer"
	BattleStatus   string    `json:"battleStatus"` // "active", "won", "lost"
	CreatedAt      string    `json:"createdAt"`
	UpdatedAt      string    `json:"updatedAt"`
	TurnHistory    []TurnAction `json:"turnHistory"`
}

type BattlePokemon struct {
	PokemonId    int      `json:"pokemonId"`
	Name         string   `json:"name"`
	CurrentHP    int      `json:"currentHp"`
	MaxHP        int      `json:"maxHp"`
	Types        []string `json:"types"`
	SpriteUrl    string   `json:"spriteUrl"`
	Moves        []PokemonMove `json:"moves"`
	Stats        PokemonStats `json:"stats"`
}

type PokemonMove struct {
	Name     string `json:"name"`
	Power    int    `json:"power"`
	Type     string `json:"type"`
	PP       int    `json:"pp"`
	CurrentPP int   `json:"currentPp"`
}

type PokemonStats struct {
	HP      int `json:"hp"`
	Attack  int `json:"attack"`
	Defense int `json:"defense"`
	Speed   int `json:"speed"`
}

type TurnAction struct {
	Turn      int    `json:"turn"`
	Actor     string `json:"actor"` // "player" or "computer"
	Action    string `json:"action"` // "attack"
	MoveName  string `json:"moveName"`
	Damage    int    `json:"damage"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type StartBattleRequest struct {
	PlayerPokemonId int `json:"playerPokemonId"`
}

type StartBattleResponse struct {
	Battle *BattleState `json:"battle,omitempty"`
	Error  string       `json:"error,omitempty"`
}

type MakeMoveRequest struct {
	MoveName string `json:"moveName"`
}

type MakeMoveResponse struct {
	Battle    *BattleState `json:"battle,omitempty"`
	TurnResult *TurnResult `json:"turnResult,omitempty"`
	Error     string       `json:"error,omitempty"`
}

type TurnResult struct {
	PlayerAction   *TurnAction `json:"playerAction,omitempty"`
	ComputerAction *TurnAction `json:"computerAction,omitempty"`
	BattleEnded    bool        `json:"battleEnded"`
	Winner         string      `json:"winner,omitempty"` // "player", "computer", or empty if ongoing
}

type GetBattleResponse struct {
	Battle *BattleState `json:"battle,omitempty"`
	Error  string       `json:"error,omitempty"`
}

func StartBattleHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Authentication required"})
		return
	}

	var req StartBattleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Invalid request body"})
		return
	}

	// Validate player Pokemon ID
	if req.PlayerPokemonId < 1 || req.PlayerPokemonId > 1000 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Player Pokemon ID must be between 1 and 1000"})
		return
	}

	log.Printf("User %s starting battle with Pokemon ID: %d", user.Username, req.PlayerPokemonId)

	// Generate random computer Pokemon (1-1000)
	rand.Seed(time.Now().UnixNano())
	computerPokemonId := rand.Intn(1000) + 1

	// Fetch both Pokemon data from PokeAPI
	playerPokemon, err := fetchBattlePokemonData(req.PlayerPokemonId)
	if err != nil {
		log.Printf("Error fetching player Pokemon data: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Failed to fetch player Pokemon data"})
		return
	}

	computerPokemon, err := fetchBattlePokemonData(computerPokemonId)
	if err != nil {
		log.Printf("Error fetching computer Pokemon data: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Failed to fetch computer Pokemon data"})
		return
	}

	// Create battle state
	now := time.Now()
	battleId := fmt.Sprintf("%s_%d", user.Sub, now.Unix())
	
	battle := &BattleState{
		BattleId:        battleId,
		UserId:          user.Sub,
		PlayerPokemon:   *playerPokemon,
		ComputerPokemon: *computerPokemon,
		CurrentTurn:     "player", // Player always goes first
		BattleStatus:    "active",
		CreatedAt:       now.Format(time.RFC3339),
		UpdatedAt:       now.Format(time.RFC3339),
		TurnHistory:     []TurnAction{},
	}

	// Save battle state to DynamoDB
	if err := saveBattleState(battle); err != nil {
		log.Printf("Error saving battle state: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(StartBattleResponse{Error: "Failed to save battle state"})
		return
	}

	log.Printf("Successfully started battle: %s, Player: %s vs Computer: %s", battleId, playerPokemon.Name, computerPokemon.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StartBattleResponse{Battle: battle})
}

func MakeMoveHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Request received: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Authentication required"})
		return
	}

	// Extract battle ID from URL path
	// Expected format: /battle/{battleId}/move
	path := r.URL.Path
	if !strings.HasPrefix(path, "/battle/") || !strings.HasSuffix(path, "/move") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Invalid URL format"})
		return
	}

	battleId := strings.TrimSuffix(strings.TrimPrefix(path, "/battle/"), "/move")
	if battleId == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Battle ID required"})
		return
	}

	var req MakeMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Invalid request body"})
		return
	}

	if req.MoveName == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Move name required"})
		return
	}

	// Load battle state
	battle, err := loadBattleState(battleId, user.Sub)
	if err != nil {
		log.Printf("Error loading battle state: %v", err)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Battle not found"})
		return
	}

	// Check if battle is still active
	if battle.BattleStatus != "active" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Battle is not active"})
		return
	}

	// Check if it's player's turn
	if battle.CurrentTurn != "player" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "It's not your turn"})
		return
	}

	// Process the turn
	turnResult, err := processBattleTurn(battle, req.MoveName)
	if err != nil {
		log.Printf("Error processing battle turn: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: err.Error()})
		return
	}

	// Save updated battle state
	battle.UpdatedAt = time.Now().Format(time.RFC3339)
	if err := saveBattleState(battle); err != nil {
		log.Printf("Error saving updated battle state: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(MakeMoveResponse{Error: "Failed to save battle state"})
		return
	}

	log.Printf("Successfully processed move for battle: %s", battleId)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(MakeMoveResponse{
		Battle:     battle,
		TurnResult: turnResult,
	})
}

func GetBattleHandler(w http.ResponseWriter, r *http.Request) {
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
		json.NewEncoder(w).Encode(GetBattleResponse{Error: "Method not allowed"})
		return
	}

	// Get the user from context
	user, ok := r.Context().Value(middleware.CognitoUserContextKey).(middleware.CognitoUser)
	if !ok {
		log.Printf("No user found in context")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(GetBattleResponse{Error: "Authentication required"})
		return
	}

	// Extract battle ID from URL path
	// Expected format: /battle/{battleId}
	path := r.URL.Path
	if !strings.HasPrefix(path, "/battle/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetBattleResponse{Error: "Invalid URL format"})
		return
	}

	battleId := strings.TrimPrefix(path, "/battle/")
	if battleId == "" || strings.Contains(battleId, "/") {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(GetBattleResponse{Error: "Battle ID required"})
		return
	}

	// Load battle state
	battle, err := loadBattleState(battleId, user.Sub)
	if err != nil {
		log.Printf("Error loading battle state: %v", err)
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(GetBattleResponse{Error: "Battle not found"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GetBattleResponse{Battle: battle})
}

func fetchBattlePokemonData(pokemonId int) (*BattlePokemon, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	// Build PokeAPI URL
	pokeAPIURL := fmt.Sprintf("%s/pokemon/%d", PokeAPIBaseURL, pokemonId)

	// Make request to PokeAPI
	resp, err := client.Get(pokeAPIURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from PokeAPI: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("PokeAPI returned status %d", resp.StatusCode)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read PokeAPI response: %w", err)
	}

	// Parse Pokemon data
	var pokeData map[string]interface{}
	if err := json.Unmarshal(body, &pokeData); err != nil {
		return nil, fmt.Errorf("failed to parse Pokemon data: %w", err)
	}

	// Extract basic info
	name, _ := pokeData["name"].(string)
	
	// Extract types
	var types []string
	if typesData, ok := pokeData["types"].([]interface{}); ok {
		for _, typeInfo := range typesData {
			if typeMap, ok := typeInfo.(map[string]interface{}); ok {
				if typeData, ok := typeMap["type"].(map[string]interface{}); ok {
					if typeName, ok := typeData["name"].(string); ok {
						types = append(types, typeName)
					}
				}
			}
		}
	}

	// Extract sprite URL
	var spriteUrl string
	if sprites, ok := pokeData["sprites"].(map[string]interface{}); ok {
		if frontDefault, ok := sprites["front_default"].(string); ok {
			spriteUrl = frontDefault
		}
	}

	// Extract stats
	var stats PokemonStats
	if statsData, ok := pokeData["stats"].([]interface{}); ok {
		for _, statInfo := range statsData {
			if statMap, ok := statInfo.(map[string]interface{}); ok {
				baseStat, _ := statMap["base_stat"].(float64)
				if statData, ok := statMap["stat"].(map[string]interface{}); ok {
					if statName, ok := statData["name"].(string); ok {
						switch statName {
						case "hp":
							stats.HP = int(baseStat)
						case "attack":
							stats.Attack = int(baseStat)
						case "defense":
							stats.Defense = int(baseStat)
						case "speed":
							stats.Speed = int(baseStat)
						}
					}
				}
			}
		}
	}

	// Extract moves (limit to first 4 for battle)
	var moves []PokemonMove
	if movesData, ok := pokeData["moves"].([]interface{}); ok {
		count := 0
		for _, moveInfo := range movesData {
			if count >= 4 {
				break
			}
			if moveMap, ok := moveInfo.(map[string]interface{}); ok {
				if moveData, ok := moveMap["move"].(map[string]interface{}); ok {
					if moveName, ok := moveData["name"].(string); ok {
						// Fetch move details for power and type
						moveDetails := fetchMoveDetails(moveName)
						moves = append(moves, moveDetails)
						count++
					}
				}
			}
		}
	}

	// Ensure we have at least one move
	if len(moves) == 0 {
		moves = append(moves, PokemonMove{
			Name:      "tackle",
			Power:     40,
			Type:      "normal",
			PP:        35,
			CurrentPP: 35,
		})
	}

	battlePokemon := &BattlePokemon{
		PokemonId: pokemonId,
		Name:      name,
		CurrentHP: stats.HP,
		MaxHP:     stats.HP,
		Types:     types,
		SpriteUrl: spriteUrl,
		Moves:     moves,
		Stats:     stats,
	}

	return battlePokemon, nil
}

func fetchMoveDetails(moveName string) PokemonMove {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	// Build PokeAPI URL for move
	moveAPIURL := fmt.Sprintf("%s/move/%s", PokeAPIBaseURL, moveName)

	// Make request to PokeAPI
	resp, err := client.Get(moveAPIURL)
	if err != nil {
		// Return default move if API call fails
		return PokemonMove{
			Name:      moveName,
			Power:     40,
			Type:      "normal",
			PP:        20,
			CurrentPP: 20,
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Return default move if API call fails
		return PokemonMove{
			Name:      moveName,
			Power:     40,
			Type:      "normal",
			PP:        20,
			CurrentPP: 20,
		}
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		// Return default move if parsing fails
		return PokemonMove{
			Name:      moveName,
			Power:     40,
			Type:      "normal",
			PP:        20,
			CurrentPP: 20,
		}
	}

	// Parse move data
	var moveData map[string]interface{}
	if err := json.Unmarshal(body, &moveData); err != nil {
		// Return default move if parsing fails
		return PokemonMove{
			Name:      moveName,
			Power:     40,
			Type:      "normal",
			PP:        20,
			CurrentPP: 20,
		}
	}

	// Extract move details
	power := 40 // default power
	if powerData, ok := moveData["power"]; ok && powerData != nil {
		if powerFloat, ok := powerData.(float64); ok {
			power = int(powerFloat)
		}
	}

	pp := 20 // default PP
	if ppData, ok := moveData["pp"]; ok && ppData != nil {
		if ppFloat, ok := ppData.(float64); ok {
			pp = int(ppFloat)
		}
	}

	moveType := "normal" // default type
	if typeData, ok := moveData["type"].(map[string]interface{}); ok {
		if typeName, ok := typeData["name"].(string); ok {
			moveType = typeName
		}
	}

	return PokemonMove{
		Name:      moveName,
		Power:     power,
		Type:      moveType,
		PP:        pp,
		CurrentPP: pp,
	}
}

func processBattleTurn(battle *BattleState, playerMoveName string) (*TurnResult, error) {
	turnResult := &TurnResult{}
	turnNumber := len(battle.TurnHistory) + 1

	// Find the player's selected move
	var playerMove *PokemonMove
	for i, move := range battle.PlayerPokemon.Moves {
		if strings.EqualFold(move.Name, playerMoveName) {
			if move.CurrentPP <= 0 {
				return nil, fmt.Errorf("move %s has no PP left", playerMoveName)
			}
			playerMove = &battle.PlayerPokemon.Moves[i]
			break
		}
	}

	if playerMove == nil {
		return nil, fmt.Errorf("move %s not found", playerMoveName)
	}

	// Select random move for computer
	rand.Seed(time.Now().UnixNano())
	computerMoveIndex := rand.Intn(len(battle.ComputerPokemon.Moves))
	computerMove := &battle.ComputerPokemon.Moves[computerMoveIndex]

	// Determine turn order based on speed
	playerGoesFirst := battle.PlayerPokemon.Stats.Speed >= battle.ComputerPokemon.Stats.Speed

	var firstMove, secondMove *PokemonMove
	var firstAttacker, secondAttacker, firstTarget, secondTarget *BattlePokemon
	var firstActor, secondActor string

	if playerGoesFirst {
		firstMove = playerMove
		secondMove = computerMove
		firstAttacker = &battle.PlayerPokemon
		secondAttacker = &battle.ComputerPokemon
		firstTarget = &battle.ComputerPokemon
		secondTarget = &battle.PlayerPokemon
		firstActor = "player"
		secondActor = "computer"
	} else {
		firstMove = computerMove
		secondMove = playerMove
		firstAttacker = &battle.ComputerPokemon
		secondAttacker = &battle.PlayerPokemon
		firstTarget = &battle.PlayerPokemon
		secondTarget = &battle.ComputerPokemon
		firstActor = "computer"
		secondActor = "player"
	}

	now := time.Now().Format(time.RFC3339)

	// First attack
	damage1 := calculateDamage(firstAttacker, firstTarget, firstMove)
	firstTarget.CurrentHP = int(math.Max(0, float64(firstTarget.CurrentHP-damage1)))
	firstMove.CurrentPP--

	firstAction := &TurnAction{
		Turn:      turnNumber,
		Actor:     firstActor,
		Action:    "attack",
		MoveName:  firstMove.Name,
		Damage:    damage1,
		Message:   fmt.Sprintf("%s used %s! It dealt %d damage!", firstAttacker.Name, firstMove.Name, damage1),
		Timestamp: now,
	}

	battle.TurnHistory = append(battle.TurnHistory, *firstAction)

	if playerGoesFirst {
		turnResult.PlayerAction = firstAction
	} else {
		turnResult.ComputerAction = firstAction
	}

	// Check if battle is over after first attack
	if firstTarget.CurrentHP <= 0 {
		if firstActor == "player" {
			battle.BattleStatus = "won"
			turnResult.Winner = "player"
		} else {
			battle.BattleStatus = "lost"
			turnResult.Winner = "computer"
		}
		turnResult.BattleEnded = true
		battle.CurrentTurn = "finished"
		return turnResult, nil
	}

	// Second attack (if first didn't end the battle)
	damage2 := calculateDamage(secondAttacker, secondTarget, secondMove)
	secondTarget.CurrentHP = int(math.Max(0, float64(secondTarget.CurrentHP-damage2)))
	secondMove.CurrentPP--

	secondAction := &TurnAction{
		Turn:      turnNumber,
		Actor:     secondActor,
		Action:    "attack",
		MoveName:  secondMove.Name,
		Damage:    damage2,
		Message:   fmt.Sprintf("%s used %s! It dealt %d damage!", secondAttacker.Name, secondMove.Name, damage2),
		Timestamp: now,
	}

	battle.TurnHistory = append(battle.TurnHistory, *secondAction)

	if playerGoesFirst {
		turnResult.ComputerAction = secondAction
	} else {
		turnResult.PlayerAction = secondAction
	}

	// Check if battle is over after second attack
	if secondTarget.CurrentHP <= 0 {
		if secondActor == "player" {
			battle.BattleStatus = "won"
			turnResult.Winner = "player"
		} else {
			battle.BattleStatus = "lost"
			turnResult.Winner = "computer"
		}
		turnResult.BattleEnded = true
		battle.CurrentTurn = "finished"
	} else {
		// Battle continues, it's still player's turn for next round
		battle.CurrentTurn = "player"
	}

	return turnResult, nil
}

func calculateDamage(attacker *BattlePokemon, defender *BattlePokemon, move *PokemonMove) int {
	// Simple damage calculation formula
	// Damage = ((2 * Level + 10) / 250) * (Attack / Defense) * Power + 2
	// Using simplified formula for demo: (Attack * Power) / (Defense * 2) with some randomness
	
	level := 50 // Assume level 50 for all Pokemon
	baseDamage := float64((2*level+10)*attacker.Stats.Attack*move.Power) / float64(250*defender.Stats.Defense)
	
	// Add some randomness (85-100% of base damage)
	rand.Seed(time.Now().UnixNano())
	randomFactor := 0.85 + rand.Float64()*0.15
	damage := int(baseDamage * randomFactor)
	
	// Ensure minimum damage of 1
	if damage < 1 {
		damage = 1
	}
	
	return damage
}

func saveBattleState(battle *BattleState) error {
	battleMutex.Lock()
	defer battleMutex.Unlock()
	
	// Store battle in memory using battleId as key
	battleStore[battle.BattleId] = battle
	return nil
}

func loadBattleState(battleId, userId string) (*BattleState, error) {
	battleMutex.RLock()
	defer battleMutex.RUnlock()
	
	// Get battle from memory
	battle, exists := battleStore[battleId]
	if !exists {
		return nil, fmt.Errorf("battle not found")
	}
	
	// Verify the battle belongs to the user
	if battle.UserId != userId {
		return nil, fmt.Errorf("battle not found")
	}
	
	return battle, nil
}