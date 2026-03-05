package models

import "time"

// SavedScript represents a user-saved SQL script linked to a connection.
type SavedScript struct {
	ID             string    `json:"id"`
	ConnectionName string    `json:"connection_name"`
	Name           string    `json:"name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
