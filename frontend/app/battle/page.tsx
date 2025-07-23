'use client';

import React, { Suspense } from 'react';
import BattlePageContent from './BattlePageContent';

function BattlePageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Pokemon Battle Arena
          </h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    </div>
  );
}

export default function BattlePage() {
  return (
    <Suspense fallback={<BattlePageLoading />}>
      <BattlePageContent />
    </Suspense>
  );
}