package models

// SavedScript represents a user-saved SQL script linked to a connection.
type SavedScript struct {
	ID             string `json:"id"`
	ConnectionName string `json:"connection_name"`
	Name           string `json:"name"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}
