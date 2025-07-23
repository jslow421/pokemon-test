'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../app/contexts/AuthContext';

export interface PokemonEntry {
  userId: string;
  entryId: string;
  pokemonName: string;
  pokemonId: number;
  category: 'favorites' | 'caught' | 'wishlist';
  notes: string;
  types: string[];
  spriteUrl: string;
  userCategory: string;
  createdAt: string;
  updatedAt: string;
}

export interface PokemonCacheContextType {
  cache: Map<number, PokemonEntry[]>;
  isLoading: boolean;
  isInitialized: boolean;
  getSavedPokemon: (pokemonId: number) => PokemonEntry[];
  isPokemonSaved: (pokemonId: number, category?: string) => boolean;
  addPokemonToCache: (pokemon: PokemonEntry) => void;
  removePokemonFromCache: (entryId: string) => void;
  loadUserPokemon: () => Promise<void>;
  clearCache: () => void;
}

const PokemonCacheContext = createContext<PokemonCacheContextType | undefined>(undefined);

export const usePokemonCache = () => {
  const context = useContext(PokemonCacheContext);
  if (!context) {
    throw new Error('usePokemonCache must be used within a PokemonCacheProvider');
  }
  return context;
};

interface PokemonCacheProviderProps {
  children: React.ReactNode;
}

export const PokemonCacheProvider: React.FC<PokemonCacheProviderProps> = ({ children }) => {
  const { apiClient, token } = useAuth();
  const [cache, setCache] = useState<Map<number, PokemonEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const loadingRef = useRef(false);

  const getSavedPokemon = useCallback((pokemonId: number): PokemonEntry[] => {
    return cache.get(pokemonId) || [];
  }, [cache]);

  const isPokemonSaved = useCallback((pokemonId: number, category?: string): boolean => {
    const savedEntries = cache.get(pokemonId) || [];
    if (!category) {
      return savedEntries.length > 0;
    }
    return savedEntries.some(entry => entry.category === category);
  }, [cache]);

  const addPokemonToCache = useCallback((pokemon: PokemonEntry) => {
    setCache(prev => {
      const newCache = new Map(prev);
      const existingEntries = newCache.get(pokemon.pokemonId) || [];
      const updatedEntries = [...existingEntries.filter(entry => entry.entryId !== pokemon.entryId), pokemon];
      newCache.set(pokemon.pokemonId, updatedEntries);
      return newCache;
    });
  }, []);

  const removePokemonFromCache = useCallback((entryId: string) => {
    setCache(prev => {
      const newCache = new Map(prev);
      for (const [pokemonId, entries] of newCache.entries()) {
        const filteredEntries = entries.filter(entry => entry.entryId !== entryId);
        if (filteredEntries.length === 0) {
          newCache.delete(pokemonId);
        } else {
          newCache.set(pokemonId, filteredEntries);
        }
      }
      return newCache;
    });
  }, []);

  const loadUserPokemon = useCallback(async () => {
    if (!apiClient || !token || loadingRef.current || isLoading) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    try {
      const response = await apiClient.get('/my-pokemon') as any;
      // API returns { "pokemon": [...] } structure
      const pokemonEntries: PokemonEntry[] = response.pokemon || [];
      
      const newCache = new Map<number, PokemonEntry[]>();
      
      if (Array.isArray(pokemonEntries)) {
        pokemonEntries.forEach(entry => {
          const existing = newCache.get(entry.pokemonId) || [];
          existing.push(entry);
          newCache.set(entry.pokemonId, existing);
        });
      }
      
      setCache(newCache);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to load user Pokemon:', error);
      setIsInitialized(true); // Prevent retry loops
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [apiClient, token, isLoading]);

  const clearCache = useCallback(() => {
    setCache(new Map());
    setIsInitialized(false);
    loadingRef.current = false;
  }, []);

  // Simple effect with no function dependencies
  useEffect(() => {
    if (token && !isInitialized && !isLoading && !loadingRef.current && apiClient) {
      loadingRef.current = true;
      setIsLoading(true);
      
      apiClient.get('/my-pokemon')
        .then((response: any) => {
          // API returns { "pokemon": [...] } structure
          const pokemonEntries: PokemonEntry[] = response.pokemon || [];
          const newCache = new Map<number, PokemonEntry[]>();
          
          if (Array.isArray(pokemonEntries)) {
            pokemonEntries.forEach(entry => {
              const existing = newCache.get(entry.pokemonId) || [];
              existing.push(entry);
              newCache.set(entry.pokemonId, existing);
            });
          }
          
          setCache(newCache);
          setIsInitialized(true);
        })
        .catch((error: any) => {
          console.error('Failed to load user Pokemon:', error);
          setIsInitialized(true);
        })
        .finally(() => {
          setIsLoading(false);
          loadingRef.current = false;
        });
    } else if (!token && isInitialized) {
      setCache(new Map());
      setIsInitialized(false);
      loadingRef.current = false;
    }
  }, [token, isInitialized, isLoading]);

  const value: PokemonCacheContextType = {
    cache,
    isLoading,
    isInitialized,
    getSavedPokemon,
    isPokemonSaved,
    addPokemonToCache,
    removePokemonFromCache,
    loadUserPokemon,
    clearCache,
  };

  return (
    <PokemonCacheContext.Provider value={value}>
      {children}
    </PokemonCacheContext.Provider>
  );
};