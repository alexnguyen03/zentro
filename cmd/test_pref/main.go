package main

import (
	"fmt"
	"zentro/internal/utils"
)

func main() {
	p, err := utils.LoadPreferences()
	fmt.Printf("Error: %v\n", err)
	fmt.Printf("ConnectTimeout: %v seconds\n", p.ConnectTimeout)
	fmt.Printf("QueryTimeout: %v seconds\n", p.QueryTimeout)
	fmt.Printf("SchemaTimeout: %v seconds\n", p.SchemaTimeout)
}
