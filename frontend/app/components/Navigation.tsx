"use client";

import Link from "next/link";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { featureFlags } from "../config/featureFlags";

export const Navigation: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Pokemon AI
            </Link>
            {user && (
              <>
                {featureFlags.pokemonSearch && (
                  <Link
                    href="/pokemon"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Pokemon Search
                  </Link>
                )}
                {featureFlags.collection && (
                  <Link
                    href="/collection"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    My Collection
                  </Link>
                )}
                {featureFlags.bedrock && (
                  <Link
                    href="/bedrock"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Test Bedrock
                  </Link>
                )}
                {featureFlags.pokify && (
                  <Link
                    href="/pokify"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Pokify
                  </Link>
                )}
                {featureFlags.battle && (
                  <Link
                    href="/battle"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Battle Arena
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-700">Welcome, {user.username}</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
