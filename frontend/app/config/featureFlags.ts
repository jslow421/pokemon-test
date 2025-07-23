export interface FeatureFlags {
  pokemonSearch: boolean;
  collection: boolean;
  bedrock: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: true,
};

// You can easily toggle features by changing these values
export const featureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: false,
};
