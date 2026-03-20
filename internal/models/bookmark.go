package models

import "time"

type Bookmark struct {
	ID        string    `json:"id"`
	Line      int       `json:"line"`
	Label     string    `json:"label,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
