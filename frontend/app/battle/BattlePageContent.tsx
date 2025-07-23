'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePokemonCache, PokemonEntry } from '../../contexts/PokemonCacheContext';
import { useRouter, useSearchParams } from 'next/navigation';

interface BattlePokemon {
  pokemonId: number;
  name: string;
  currentHp: number;
  maxHp: number;
  types: string[];
  spriteUrl: string;
  moves: PokemonMove[];
  stats: PokemonStats;
}

interface PokemonMove {
  name: string;
  power: number;
  type: string;
  pp: number;
  currentPp: number;
}

interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

interface TurnAction {
  turn: number;
  actor: string;
  action: string;
  moveName: string;
  damage: number;
  message: string;
  timestamp: string;
}

interface BattleState {
  battleId: string;
  userId: string;
  playerPokemon: BattlePokemon;
  computerPokemon: BattlePokemon;
  currentTurn: string;
  battleStatus: string;
  createdAt: string;
  updatedAt: string;
  turnHistory: TurnAction[];
}

interface TurnResult {
  playerAction?: TurnAction;
  computerAction?: TurnAction;
  battleEnded: boolean;
  winner?: string;
}

export default function BattlePageContent() {
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonEntry | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isStartingBattle, setIsStartingBattle] = useState(false);
  const [isMakingMove, setIsMakingMove] = useState(false);
  const [error, setError] = useState('');
  const [gamePhase, setGamePhase] = useState<'selection' | 'battle' | 'ended'>('selection');
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);

  const { apiClient, token } = useAuth();
  const isAuthenticated = !!token;
  const { cache, isLoading } = usePokemonCache();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get caught Pokemon from cache
  const caughtPokemon = Array.from(cache.values())
    .flat()
    .filter(p => p.category === 'caught');

  useEffect(() => {
    if (!isAuthenticated) {
      setError('Please login to battle Pokemon');
      router.push('/login');
      return;
    }
    setError('');
  }, [isAuthenticated, router]);

  // Auto-select Pokemon from URL parameter
  useEffect(() => {
    const pokemonIdParam = searchParams.get('pokemon');
    if (pokemonIdParam && caughtPokemon.length > 0) {
      const pokemonId = parseInt(pokemonIdParam);
      const preselectedPokemon = caughtPokemon.find(p => p.pokemonId === pokemonId);
      if (preselectedPokemon && !selectedPokemon) {
        setSelectedPokemon(preselectedPokemon);
      }
    }
  }, [searchParams, caughtPokemon, selectedPokemon]);

  const startBattle = async () => {
    if (!selectedPokemon) {
      setError('Please select a Pokemon to battle with');
      return;
    }

    setIsStartingBattle(true);
    setError('');

    try {
      const response = await apiClient.post<{ battle?: BattleState; error?: string }>('/start-battle', {
        playerPokemonId: selectedPokemon.pokemonId,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.battle) {
        setBattleState(response.battle);
        setGamePhase('battle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start battle');
    } finally {
      setIsStartingBattle(false);
    }
  };

  const makeMove = async (moveName: string) => {
    if (!battleState) return;

    setIsMakingMove(true);
    setError('');
    setTurnResult(null);

    try {
      const response = await apiClient.post<{ battle?: BattleState; turnResult?: TurnResult; error?: string }>(
        `/battle/${battleState.battleId}/move`,
        { moveName }
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.battle && response.turnResult) {
        setBattleState(response.battle);
        setTurnResult(response.turnResult);
        
        if (response.turnResult.battleEnded) {
          setGamePhase('ended');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make move');
    } finally {
      setIsMakingMove(false);
    }
  };

  const resetBattle = () => {
    setBattleState(null);
    setSelectedPokemon(null);
    setTurnResult(null);
    setGamePhase('selection');
    setError('');
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      normal: 'bg-gray-400',
      fire: 'bg-red-500',
      water: 'bg-blue-500',
      electric: 'bg-yellow-400',
      grass: 'bg-green-500',
      ice: 'bg-blue-200',
      fighting: 'bg-red-700',
      poison: 'bg-purple-500',
      ground: 'bg-yellow-600',
      flying: 'bg-indigo-400',
      psychic: 'bg-pink-500',
      bug: 'bg-green-400',
      rock: 'bg-yellow-800',
      ghost: 'bg-purple-700',
      dragon: 'bg-indigo-700',
      dark: 'bg-gray-800',
      steel: 'bg-gray-500',
      fairy: 'bg-pink-300',
    };
    return colors[type] || 'bg-gray-400';
  };

  const getHpPercentage = (current: number, max: number) => {
    return Math.max(0, (current / max) * 100);
  };

  const getHpColor = (percentage: number) => {
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Pokemon Battle Arena
          </h1>
          <p className="text-gray-600">
            Select a Pokemon from your caught collection and battle against a random opponent!
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Pokemon Selection Phase */}
        {gamePhase === 'selection' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Choose Your Pokemon</h2>
              
              {isLoading && (
                <p className="text-gray-600">Loading your Pokemon collection...</p>
              )}

              {!isLoading && caughtPokemon.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎯</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No caught Pokemon found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You need to catch some Pokemon before you can battle!
                  </p>
                  <button
                    onClick={() => router.push('/pokemon')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Search Pokemon
                  </button>
                </div>
              )}

              {!isLoading && caughtPokemon.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {caughtPokemon.map((pokemon) => (
                    <div
                      key={pokemon.entryId}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPokemon?.entryId === pokemon.entryId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPokemon(pokemon)}
                    >
                      <div className="text-center">
                        {pokemon.spriteUrl && (
                          <img
                            src={pokemon.spriteUrl}
                            alt={pokemon.pokemonName}
                            className="w-16 h-16 mx-auto mb-2"
                          />
                        )}
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {pokemon.pokemonName}
                        </h3>
                        <p className="text-sm text-gray-600">#{pokemon.pokemonId}</p>
                        <div className="flex flex-wrap justify-center gap-1 mt-2">
                          {(pokemon.types || []).map((type, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 rounded text-white text-xs ${getTypeColor(type)}`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPokemon && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Selected Pokemon: {selectedPokemon.pokemonName}
                </h3>
                <button
                  onClick={startBattle}
                  disabled={isStartingBattle}
                  className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStartingBattle ? 'Starting Battle...' : 'Start Battle!'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Battle Phase */}
        {gamePhase === 'battle' && battleState && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Battle in Progress</h2>
                <div className="text-sm text-gray-600">
                  Turn: {battleState.currentTurn === 'player' ? 'Your Turn' : 'Computer Turn'}
                </div>
              </div>

              {/* Pokemon Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Player Pokemon */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Your Pokemon</h3>
                  <div className="text-center">
                    <img
                      src={battleState.playerPokemon.spriteUrl}
                      alt={battleState.playerPokemon.name}
                      className="w-24 h-24 mx-auto mb-2"
                    />
                    <h4 className="font-bold text-lg capitalize">{battleState.playerPokemon.name}</h4>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>HP</span>
                        <span>{battleState.playerPokemon.currentHp}/{battleState.playerPokemon.maxHp}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getHpColor(
                            getHpPercentage(battleState.playerPokemon.currentHp, battleState.playerPokemon.maxHp)
                          )}`}
                          style={{
                            width: `${getHpPercentage(battleState.playerPokemon.currentHp, battleState.playerPokemon.maxHp)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Computer Pokemon */}
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-2">Opponent Pokemon</h3>
                  <div className="text-center">
                    <img
                      src={battleState.computerPokemon.spriteUrl}
                      alt={battleState.computerPokemon.name}
                      className="w-24 h-24 mx-auto mb-2"
                    />
                    <h4 className="font-bold text-lg capitalize">{battleState.computerPokemon.name}</h4>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>HP</span>
                        <span>{battleState.computerPokemon.currentHp}/{battleState.computerPokemon.maxHp}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getHpColor(
                            getHpPercentage(battleState.computerPokemon.currentHp, battleState.computerPokemon.maxHp)
                          )}`}
                          style={{
                            width: `${getHpPercentage(battleState.computerPokemon.currentHp, battleState.computerPokemon.maxHp)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Turn Result Display */}
              {turnResult && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-2">Last Turn:</h4>
                  <div className="space-y-2 text-sm">
                    {turnResult.playerAction && (
                      <p className="text-blue-700">• {turnResult.playerAction.message}</p>
                    )}
                    {turnResult.computerAction && (
                      <p className="text-red-700">• {turnResult.computerAction.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Move Selection */}
              {battleState.currentTurn === 'player' && !isMakingMove && (
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Choose your move:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {battleState.playerPokemon.moves.map((move, index) => (
                      <button
                        key={index}
                        onClick={() => makeMove(move.name)}
                        disabled={move.currentPp <= 0}
                        className={`p-3 rounded-md border text-left transition-colors ${
                          move.currentPp <= 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white hover:bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize">{move.name}</p>
                            <p className="text-sm text-gray-600">Power: {move.power || 'N/A'}</p>
                            <span className={`inline-block px-2 py-1 rounded text-xs text-white ${getTypeColor(move.type)}`}>
                              {move.type}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">PP: {move.currentPp}/{move.pp}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isMakingMove && (
                <div className="text-center py-4">
                  <p className="text-gray-600">Processing move...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Battle End Phase */}
        {gamePhase === 'ended' && battleState && turnResult && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <div className="mb-6">
                {turnResult.winner === 'player' ? (
                  <div>
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-green-600 mb-2">Victory!</h2>
                    <p className="text-gray-700">
                      Your {battleState.playerPokemon.name} defeated {battleState.computerPokemon.name}!
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-6xl mb-4">😞</div>
                    <h2 className="text-3xl font-bold text-red-600 mb-2">Defeat!</h2>
                    <p className="text-gray-700">
                      {battleState.computerPokemon.name} defeated your {battleState.playerPokemon.name}!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={resetBattle}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Battle Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}