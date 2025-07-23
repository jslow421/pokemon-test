export interface FeatureFlags {
  pokemonSearch: boolean;
  collection: boolean;
  bedrock: boolean;
  pokify: boolean;
  battle: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: true,
  pokify: true,
  battle: true,
};

// You can easily toggle features by changing these values
export const featureFlags: FeatureFlags = {
  pokemonSearch: true,
  collection: true,
  bedrock: false,
  pokify: true,
  battle: true,
};
