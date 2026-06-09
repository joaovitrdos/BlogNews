package handlers

import (
	"testing"
)

func TestIsValidUUID(t *testing.T) {
	valid := []string{
		"550e8400-e29b-41d4-a716-446655440000",
		"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		"00000000-0000-0000-0000-000000000000",
	}
	for _, id := range valid {
		if !isValidUUID(id) {
			t.Errorf("isValidUUID(%q) = false; quer true", id)
		}
	}

	invalid := []string{
		"",
		"not-a-uuid",
		"550e8400e29b41d4a716446655440000",
		"550e8400-e29b-41d4-a716-44665544000",
		"550e8400-e29b-41d4-a716-4466554400000",
		"ZZZZZZZZ-e29b-41d4-a716-446655440000",
		"550e8400-e29b-41d4-a716_446655440000",
	}
	for _, id := range invalid {
		if isValidUUID(id) {
			t.Errorf("isValidUUID(%q) = true; quer false", id)
		}
	}
}

func TestClamp(t *testing.T) {
	tests := []struct {
		v, min, max, want int
	}{
		{5, 1, 10, 5},
		{0, 1, 10, 1},
		{15, 1, 10, 10},
		{1, 1, 10, 1},
		{10, 1, 10, 10},
	}
	for _, tt := range tests {
		got := clamp(tt.v, tt.min, tt.max)
		if got != tt.want {
			t.Errorf("clamp(%d, %d, %d) = %d; quer %d", tt.v, tt.min, tt.max, got, tt.want)
		}
	}
}
