package handlers

import "testing"

func TestBoolPtr(t *testing.T) {
	tests := []struct {
		name  string
		input bool
		want  bool
	}{
		{
			name:  "true value",
			input: true,
			want:  true,
		},
		{
			name:  "false value",
			input: false,
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := boolPtr(tt.input)
			if result == nil {
				t.Error("boolPtr() returned nil")
				return
			}
			if *result != tt.want {
				t.Errorf("boolPtr() = %v, want %v", *result, tt.want)
			}
		})
	}
}

func TestStringPtr(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "non-empty string",
			input: "test string",
			want:  "test string",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "string with special characters",
			input: "hello world!@#$%",
			want:  "hello world!@#$%",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := stringPtr(tt.input)
			if result == nil {
				t.Error("stringPtr() returned nil")
				return
			}
			if *result != tt.want {
				t.Errorf("stringPtr() = %v, want %v", *result, tt.want)
			}
		})
	}
}