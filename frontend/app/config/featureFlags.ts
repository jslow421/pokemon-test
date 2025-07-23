export interface FeatureFlags {
  pokemonSearch: boolean;
  collection: boolean;
  bedrock: boolean;
  pokify: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: true,
  pokify: true,
};

// You can easily toggle features by changing these values
export const featureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: false,
  pokify: true,
};
