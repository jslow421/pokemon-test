package config

// JWTSecret is the secret key for JWT signing
// In production, this should be loaded from environment variables
var JWTSecret = []byte("your-secret-key-change-this-in-production")