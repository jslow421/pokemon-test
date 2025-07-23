package handlers

import "testing"

func TestCalculateSecretHash(t *testing.T) {
	tests := []struct {
		name         string
		username     string
		clientID     string
		clientSecret string
		expected     string
	}{
		{
			name:         "basic case",
			username:     "testuser",
			clientID:     "testclient",
			clientSecret: "testsecret",
			expected:     "hcii2PAG6aeN+bovXSeIOOiqXTz6HWFUpeuqtE6vyD0=",
		},
		{
			name:         "empty username",
			username:     "",
			clientID:     "testclient",
			clientSecret: "testsecret",
			expected:     "HmsXoFg+XMvLDn4H03z6Y1SuZuxdzephwpDW9KudZxw=",
		},
		{
			name:         "different secret",
			username:     "testuser",
			clientID:     "testclient",
			clientSecret: "differentsecret",
			expected:     "wAWS+UpNVoA8k9i1NUnZXF1wAtoWUrkcZRwNWLgkGDg=",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateSecretHash(tt.username, tt.clientID, tt.clientSecret)
			if result != tt.expected {
				t.Errorf("calculateSecretHash() = %v, want %v", result, tt.expected)
			}
		})
	}
}