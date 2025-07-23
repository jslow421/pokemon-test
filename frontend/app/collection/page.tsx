'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePokemonCache, PokemonEntry } from '../../contexts/PokemonCacheContext';
import { useRouter } from 'next/navigation';


interface DeleteResponse {
  success?: boolean;
  error?: string;
}

export default function CollectionPage() {
  const [filteredPokemon, setFilteredPokemon] = useState<PokemonEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const { apiClient, token } = useAuth();
  const isAuthenticated = !!token;
  const { cache, isLoading, removePokemonFromCache, updatePokemonInCache } = usePokemonCache();
  const router = useRouter();

  const categories = [
    { value: 'all', label: '🌟 All Pokemon', emoji: '🌟' },
    { value: 'favorites', label: '⭐ Favorites', emoji: '⭐' },
    { value: 'caught', label: '🎯 Caught', emoji: '🎯' },
    { value: 'wishlist', label: '💭 Wishlist', emoji: '💭' },
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      setError('Please login to view your collection');
      router.push('/login');
      return;
    }
    setError('');
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Get all Pokemon from cache inside the effect
    const allPokemon = Array.from(cache.values()).flat();
    
    if (selectedCategory === 'all') {
      setFilteredPokemon(allPokemon);
    } else {
      setFilteredPokemon(allPokemon.filter(p => p.category === selectedCategory));
    }
  }, [cache, selectedCategory]);

  // Get all Pokemon for display counts (this doesn't trigger effects)
  const pokemon = Array.from(cache.values()).flat();

  const deletePokemon = async (entryId: string, pokemonName: string) => {
    if (!isAuthenticated) {
      setError('Please login to delete Pokemon');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${pokemonName} from your collection?`)) {
      return;
    }

    try {
      const data = await apiClient.delete<DeleteResponse>(`/delete-pokemon/${entryId}`);

      if (data.error) {
        throw new Error(data.error);
      }

      // Remove the Pokemon from cache
      removePokemonFromCache(entryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete Pokemon');
    }
  };

  const updatePokemon = async (entryId: string, updates: { category?: 'favorites' | 'caught' | 'wishlist'; notes?: string }) => {
    if (!isAuthenticated) {
      setError('Please login to update Pokemon');
      return;
    }

    try {
      const data = await apiClient.put<{ success: boolean; error?: string }>(`/update-pokemon/${entryId}`, updates);

      if (data.error) {
        throw new Error(data.error);
      }

      // Update the Pokemon in cache
      updatePokemonInCache(entryId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Pokemon');
    }
  };

  const handleCategoryChange = (entryId: string, newCategory: 'favorites' | 'caught' | 'wishlist') => {
    updatePokemon(entryId, { category: newCategory });
  };

  const handleNoteEdit = (entryId: string, currentNote: string) => {
    setEditingNote(entryId);
    setNoteValue(currentNote);
  };

  const handleNoteSave = (entryId: string) => {
    updatePokemon(entryId, { notes: noteValue });
    setEditingNote(null);
    setNoteValue('');
  };

  const handleNoteCancel = () => {
    setEditingNote(null);
    setNoteValue('');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: { [key: string]: string } = {
      favorites: '⭐',
      caught: '🎯',
      wishlist: '💭',
    };
    return emojiMap[category] || '🌟';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            My Pokemon Collection
          </h1>
          <p className="text-gray-600">
            View and manage your saved Pokemon
          </p>
        </div>

        {/* Category Filter */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
                {selectedCategory === category.value && (
                  <span className="ml-2 bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                    {category.value === 'all' 
                      ? pokemon.length 
                      : pokemon.filter(p => p.category === category.value).length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading your Pokemon collection...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredPokemon.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedCategory === 'all' 
                ? 'No Pokemon in your collection yet'
                : `No Pokemon in ${selectedCategory}`
              }
            </h3>
            <p className="text-gray-600 mb-4">
              Start building your collection by searching and saving Pokemon!
            </p>
            <button
              onClick={() => router.push('/pokemon')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Search Pokemon
            </button>
          </div>
        )}

        {/* Pokemon Grid */}
        {!isLoading && !error && filteredPokemon.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPokemon.map((entry) => (
              <div key={entry.entryId} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  {/* Header with category and remove button */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 capitalize">
                        {entry.pokemonName}
                      </h3>
                      <p className="text-sm text-gray-600">#{entry.pokemonId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCategoryEmoji(entry.category)}</span>
                      <button
                        onClick={() => deletePokemon(entry.entryId, entry.pokemonName)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                        title="Remove from collection"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Category Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={entry.category}
                      onChange={(e) => handleCategoryChange(entry.entryId, e.target.value as 'favorites' | 'caught' | 'wishlist')}
                      className="w-full px-3 py-1 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="favorites">⭐ Favorites</option>
                      <option value="caught">🎯 Caught</option>
                      <option value="wishlist">💭 Wishlist</option>
                    </select>
                  </div>

                  {/* Pokemon Image */}
                  {entry.spriteUrl && (
                    <div className="text-center mb-4">
                      <img
                        src={entry.spriteUrl}
                        alt={entry.pokemonName}
                        className="w-24 h-24 mx-auto"
                      />
                    </div>
                  )}

                  {/* Types */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(entry.types || []).map((type, index) => (
                      <span
                        key={index}
                        className={`px-2 py-1 rounded text-white text-xs font-medium ${getTypeColor(type)}`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    ))}
                  </div>

                  {/* Notes */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      {editingNote !== entry.entryId && (
                        <button
                          onClick={() => handleNoteEdit(entry.entryId, entry.notes || '')}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Edit note"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    {editingNote === entry.entryId ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder="Add a note about this Pokemon..."
                          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white placeholder-gray-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleNoteSave(entry.entryId)}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleNoteCancel}
                            className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded min-h-[2.5rem] flex items-center">
                        {entry.notes ? (
                          <span className="italic">&ldquo;{entry.notes}&rdquo;</span>
                        ) : (
                          <span className="text-gray-500">No notes added</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-xs text-gray-500 border-t pt-2">
                    <p>Added: {formatDate(entry.createdAt)}</p>
                    <p className="capitalize">Category: {entry.category}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}