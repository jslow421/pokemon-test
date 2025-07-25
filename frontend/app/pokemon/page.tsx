"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { usePokemonCache } from "../../contexts/PokemonCacheContext";
import { useAuth } from "../contexts/AuthContext";

interface PokemonData {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  sprites: {
    front_default: string;
  };
  cries: {
    latest: string;
  };
  types: Array<{
    type: {
      name: string;
    };
  }>;
  stats: Array<{
    base_stat: number;
    stat: {
      name: string;
    };
  }>;
  abilities: Array<{
    ability: {
      name: string;
    };
    is_hidden: boolean;
  }>;
}

interface PokemonResponse {
  data?: PokemonData;
  error?: string;
}

interface SavePokemonResponse {
  success: boolean;
  entryId?: string;
  error?: string;
}

interface PokemonIdentifyResponse {
  pokemon_name: string;
  confidence: number;
  pokeapi_data?: PokemonData;
  error?: string;
}

export default function PokemonPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("favorites");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Image upload states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] =
    useState<PokemonIdentifyResponse | null>(null);
  const [imageSearchCollapsed, setImageSearchCollapsed] = useState(false);

  const { token, apiClient } = useAuth();
  const { isPokemonSaved, addPokemonToCache } = usePokemonCache();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle automatic search when loading with search parameter
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam && token && !pokemon && !isLoading) {
      setSearchTerm(searchParam);
      
      // Trigger search automatically with the search parameter
      const performAutoSearch = async () => {
        setError("");
        setPokemon(null);
        setIsLoading(true);

        try {
          const data: PokemonResponse = await apiClient.get(
            `/pokemon/${searchParam.toLowerCase().trim()}`
          );

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.data) {
            setPokemon(data.data);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
          setIsLoading(false);
        }
      };
      
      performAutoSearch();
    }
  }, [searchParams, token, pokemon, isLoading, apiClient]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Please login to search for Pokemon");
      router.push("/login");
      return;
    }

    if (!searchTerm.trim()) {
      setError("Please enter a Pokemon name or ID");
      return;
    }

    setError("");
    setPokemon(null);
    setIsLoading(true);

    try {
      const data: PokemonResponse = await apiClient.get(
        `/pokemon/${searchTerm.toLowerCase().trim()}`
      );

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.data) {
        setPokemon(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const playCry = () => {
    if (pokemon?.cries?.latest) {
      const audio = new Audio(pokemon.cries.latest);
      audio.play().catch((error) => {
        console.error("Error playing Pokemon cry:", error);
      });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image too large (max 5MB)");
        return;
      }

      setSelectedImage(file);
      setError("");
      setImageSearchCollapsed(false);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageIdentification = async () => {
    if (!selectedImage || !token) {
      setError("Please select an image and login first");
      return;
    }

    setIsIdentifying(true);
    setError("");
    setIdentificationResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const result: PokemonIdentifyResponse = await apiClient.post(
        "/pokemon-identify",
        formData
      );

      if (result.error) {
        throw new Error(result.error);
      }

      setIdentificationResult(result);

      // If identification was successful and we have PokeAPI data, populate the pokemon state
      if (result.pokeapi_data) {
        setPokemon(result.pokeapi_data);
        // Collapse the image search box
        setImageSearchCollapsed(true);
        clearImage();
      } else if (
        result.pokemon_name &&
        result.pokemon_name !== "unknown" &&
        result.confidence >= 0.5
      ) {
        // Update search term and automatically trigger search
        setSearchTerm(result.pokemon_name);
        // Collapse the image search box
        setImageSearchCollapsed(true);
        clearImage();
        // Trigger search automatically
        const syntheticEvent = {
          preventDefault: () => {},
        } as React.FormEvent;
        await handleSearch(syntheticEvent);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during identification"
      );
    } finally {
      setIsIdentifying(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIdentificationResult(null);
  };

  const savePokemon = async () => {
    if (!pokemon || !token) {
      setSaveMessage("Please login and search for a Pokemon first");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const saveData = {
        pokemonName: pokemon.name,
        pokemonId: pokemon.id,
        category: selectedCategory,
        notes: notes,
        types: pokemon.types?.map((t) => t.type.name) || [],
        spriteUrl: pokemon.sprites?.front_default || "",
      };

      const result = (await apiClient.post(
        "/save-pokemon",
        saveData
      )) as SavePokemonResponse;

      if (!result.success) {
        throw new Error(result.error || "Failed to save Pokemon");
      }

      // Update cache with the new entry
      const newEntry = {
        userId: "", // Not returned by API, but not needed for cache functionality
        entryId: result.entryId || `${pokemon.name}_${Date.now()}`,
        pokemonName: pokemon.name,
        pokemonId: pokemon.id,
        category: selectedCategory as "favorites" | "caught" | "wishlist",
        notes: notes,
        types: pokemon.types?.map((t) => t.type.name) || [],
        spriteUrl: pokemon.sprites?.front_default || "",
        userCategory: `USER##CATEGORY#${selectedCategory}`, // userId not needed for cache key
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addPokemonToCache(newEntry);

      setSaveMessage(`✅ ${pokemon.name} saved to ${selectedCategory}!`);
      setNotes(""); // Clear notes after successful save
    } catch (err) {
      setSaveMessage(
        `❌ ${err instanceof Error ? err.message : "Failed to save Pokemon"}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatStatName = (statName: string) => {
    return statName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      normal: "bg-gray-400",
      fire: "bg-red-500",
      water: "bg-blue-500",
      electric: "bg-yellow-400",
      grass: "bg-green-500",
      ice: "bg-blue-200",
      fighting: "bg-red-700",
      poison: "bg-purple-500",
      ground: "bg-yellow-600",
      flying: "bg-indigo-400",
      psychic: "bg-pink-500",
      bug: "bg-green-400",
      rock: "bg-yellow-800",
      ghost: "bg-purple-700",
      dragon: "bg-indigo-700",
      dark: "bg-gray-800",
      steel: "bg-gray-500",
      fairy: "bg-pink-300",
    };
    return colors[type] || "bg-gray-400";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Pokemon Search & Identification
          </h1>
          <p className="text-gray-600">
            Search for Pokemon by name/ID or upload an image to identify them
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            🔍 Search by Name or ID
          </h2>
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="Enter Pokemon name or ID (e.g., pikachu, 25)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {/* Image Upload Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              📸 Identify by Image
            </h2>
            {imageSearchCollapsed && (
              <button
                onClick={() => setImageSearchCollapsed(false)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Upload another image
              </button>
            )}
          </div>

          {imageSearchCollapsed ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-green-800 text-sm">
                ✅ Image identified successfully! Pokemon data is shown below.
              </p>
            </div>
          ) : !imagePreview ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 text-gray-400">
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    />
                  </svg>
                </div>
                <div>
                  <label htmlFor="pokemon-image" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Click to upload a Pokemon image
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      PNG, JPG, WebP up to 5MB
                    </span>
                    <input
                      id="pokemon-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Pokemon to identify"
                  className="max-w-xs mx-auto rounded-lg shadow-md"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  ×
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={handleImageIdentification}
                  disabled={isIdentifying}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isIdentifying ? "Identifying..." : "Identify Pokemon"}
                </button>
              </div>

              {identificationResult && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Identification Result:
                  </h3>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Pokemon:</span>{" "}
                    {identificationResult.pokemon_name}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Confidence:</span>{" "}
                    {(identificationResult.confidence * 100).toFixed(1)}%
                  </p>
                  {identificationResult.confidence < 0.5 && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ⚠️ Low confidence - the image might not contain a clear
                      Pokemon or might be hard to identify.
                    </p>
                  )}
                  {identificationResult.pokeapi_data && (
                    <p className="text-sm text-green-600 mt-2">
                      ✅ Pokemon data loaded! Scroll down to see stats and save
                      to your collection.
                    </p>
                  )}
                  {identificationResult.pokemon_name &&
                    identificationResult.pokemon_name !== "unknown" &&
                    identificationResult.confidence >= 0.5 &&
                    !identificationResult.pokeapi_data && (
                      <div className="mt-3">
                        <button
                          onClick={async () => {
                            setSearchTerm(identificationResult.pokemon_name);
                            // Trigger search automatically
                            const syntheticEvent = {
                              preventDefault: () => {},
                            } as React.FormEvent;
                            await handleSearch(syntheticEvent);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          🔍 Search for {identificationResult.pokemon_name}
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Pokemon Details */}
        {pokemon && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Image and Basic Info */}
              <div className="text-center">
                {pokemon.sprites?.front_default && (
                  <img
                    src={pokemon.sprites.front_default}
                    alt={pokemon.name}
                    className="w-48 h-48 mx-auto mb-4"
                  />
                )}

                <h2 className="text-2xl font-bold text-gray-900 capitalize mb-2">
                  {pokemon.name}
                </h2>

                <p className="text-gray-800 text-lg font-semibold mb-2">
                  #{pokemon.id}
                </p>

                {/* Saved Status Indicators */}
                {isPokemonSaved(pokemon.id) && (
                  <div className="mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-blue-800 mb-2">
                        💾 Already in your collection:
                      </p>
                      <div className="flex justify-center gap-2 flex-wrap">
                        {isPokemonSaved(pokemon.id, "favorites") && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            ⭐ Favorites
                          </span>
                        )}
                        {isPokemonSaved(pokemon.id, "caught") && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            🎯 Caught
                          </span>
                        )}
                        {isPokemonSaved(pokemon.id, "wishlist") && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            💭 Wishlist
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Types */}
                <div className="flex justify-center gap-2 mb-4">
                  {pokemon.types?.map((type, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getTypeColor(
                        type.type.name
                      )}`}
                    >
                      {type.type.name.charAt(0).toUpperCase() +
                        type.type.name.slice(1)}
                    </span>
                  ))}
                </div>

                {/* Cry Button */}
                {pokemon.cries?.latest && (
                  <button
                    onClick={playCry}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mb-4"
                  >
                    🔊 Play Cry
                  </button>
                )}

                {/* Save to Collection Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Save to Collection
                  </h3>

                  {/* Category Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="favorites">⭐ Favorites</option>
                      <option value="caught">🎯 Caught</option>
                      <option value="wishlist">💭 Wishlist</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add your notes about this Pokemon..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 resize-none"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={savePokemon}
                    disabled={isSaving}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : `Save to ${selectedCategory}`}
                  </button>

                  {/* Save Message */}
                  {saveMessage && (
                    <div
                      className={`mt-3 p-2 rounded text-sm ${
                        saveMessage.includes("✅")
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {saveMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Stats and Details */}
              <div>
                {/* Physical Stats */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Physical Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        Height
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {(pokemon.height / 10).toFixed(1)} m
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        Weight
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {(pokemon.weight / 10).toFixed(1)} kg
                      </p>
                    </div>
                  </div>
                </div>

                {/* Base Experience */}
                {pokemon.base_experience && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Base Experience
                    </h3>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-xl font-bold text-gray-900">
                        {pokemon.base_experience} XP
                      </p>
                    </div>
                  </div>
                )}

                {/* Battle Stats */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Battle Stats
                  </h3>
                  <div className="space-y-3">
                    {pokemon.stats?.map((stat, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-3 items-center"
                      >
                        <span className="col-span-3 text-base font-semibold text-gray-800">
                          {formatStatName(stat.stat.name)}
                        </span>
                        <div className="col-span-7 bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full"
                            style={{
                              width: `${Math.min(
                                (stat.base_stat / 200) * 100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <span className="col-span-2 text-base font-bold text-gray-900 text-right">
                          {stat.base_stat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Abilities */}
                {pokemon.abilities && pokemon.abilities.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      Abilities
                    </h3>
                    <div className="space-y-3">
                      {pokemon.abilities.map((ability, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <span className="px-3 py-2 bg-gray-100 rounded text-base font-semibold text-gray-800 capitalize">
                            {ability.ability.name.replace("-", " ")}
                          </span>
                          {ability.is_hidden && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-semibold">
                              Hidden
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
