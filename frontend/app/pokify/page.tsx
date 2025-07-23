"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PokifyResponse {
  pokemon_image?: string;
  error?: string;
}

type ProcessingState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export default function PokifyPage() {
  const { token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please select a JPEG or PNG image file.');
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setErrorMessage('File size must be less than 5MB.');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setGeneratedImage(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage('Please select a JPEG or PNG image file.');
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        setErrorMessage('File size must be less than 5MB.');
        return;
      }

      setSelectedFile(file);
      setErrorMessage(null);
      setGeneratedImage(null);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedImage(null);
    setErrorMessage(null);
    setProcessingState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePokify = async () => {
    if (!selectedFile || !token) return;

    setProcessingState('uploading');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      setProcessingState('processing');

      const response = await fetch('http://localhost:8181/pokify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data: PokifyResponse = await response.json();

      if (response.ok && data.pokemon_image) {
        setGeneratedImage(data.pokemon_image);
        setProcessingState('complete');
      } else {
        setErrorMessage(data.error || 'Failed to generate Pokemon character');
        setProcessingState('error');
      }
    } catch (error) {
      console.error('Pokify error:', error);
      setErrorMessage('Network error. Please try again.');
      setProcessingState('error');
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = 'pokemon-character.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProcessingMessage = () => {
    switch (processingState) {
      case 'uploading':
        return 'Uploading your image...';
      case 'processing':
        return 'Transforming your image into a Pokemon...';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Pokify Your Photo
          </h1>
          <p className="text-lg text-gray-600">
            Transform yourself into a unique Pokemon character
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* File Upload Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Upload Your Photo
            </h2>
            
            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-4">
                  <div className="text-4xl text-gray-400">📷</div>
                  <div>
                    <p className="text-lg text-gray-600">
                      Drag and drop your photo here, or click to select
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Supports JPEG and PNG files up to 5MB
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📷</div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearFile}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                </div>

                {previewUrl && (
                  <div className="text-center">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-xs max-h-64 object-contain mx-auto rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Processing State */}
          {(processingState === 'uploading' || processingState === 'processing') && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-blue-800">{getProcessingMessage()}</p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="text-center mb-8">
            <button
              onClick={handlePokify}
              disabled={!selectedFile || processingState === 'uploading' || processingState === 'processing'}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
                selectedFile && processingState !== 'uploading' && processingState !== 'processing'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {processingState === 'uploading' || processingState === 'processing' 
                ? 'Pokifying...' 
                : 'Transform to Pokemon'
              }
            </button>
          </div>

          {/* Results Section */}
          {generatedImage && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 text-center">
                Your Pokemon Character
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Original Image */}
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-3">Original</h3>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Original"
                      className="max-w-full max-h-64 object-contain mx-auto rounded-lg shadow-md"
                    />
                  )}
                </div>

                {/* Generated Pokemon */}
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-700 mb-3">Pokemon Version</h3>
                  <img
                    src={`data:image/png;base64,${generatedImage}`}
                    alt="Generated Pokemon"
                    className="max-w-full max-h-64 object-contain mx-auto rounded-lg shadow-md"
                  />
                </div>
              </div>

              {/* Download and Try Again Buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleDownload}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Download Pokemon
                </button>
                <button
                  onClick={handleClearFile}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}