package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"time"

	"zentro/internal/core"
	"zentro/internal/db"
	"zentro/internal/driver/postgres"
	"zentro/internal/utils"

	// Register generic sql driver
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	core.Register(postgres.New())
	profiles, err := utils.LoadConnections()
	if err != nil {
		fmt.Printf("Error loading connections: %v\n", err)
		os.Exit(1)
	}

	for _, p := range profiles {
		if p.Driver != "postgres" {
			continue
		}

		fmt.Printf("\n--- Testing Postgres Profile: %s ---\n", p.Name)
		fmt.Printf("Host: %s, DB: %s, User: %s, Timeout: %d\n", p.Host, p.DBName, p.Username, p.ConnectTimeout)

		userInfo := url.UserPassword(p.Username, p.Password).String()
		// just checking if we can build the string without panics
		_ = fmt.Sprintf(
			"postgres://%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
			userInfo, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
		)

		maskedUserInfo := url.UserPassword(p.Username, "***").String()
		maskedStr := fmt.Sprintf(
			"postgres://%s@%s:%d/%s?sslmode=%s&connect_timeout=%d",
			maskedUserInfo, p.Host, p.Port, p.DBName, p.SSLMode, p.ConnectTimeout,
		)
		fmt.Printf("DSN built: %s\n", maskedStr)

		start := time.Now()
		conn, err := db.OpenConnection(p)
		if err != nil {
			fmt.Printf("Open error: %v (took %v)\n", err, time.Since(start))
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		err = conn.PingContext(ctx)
		cancel()

		if err != nil {
			fmt.Printf("Ping error: %v (took %v)\n", err, time.Since(start))
		} else {
			fmt.Printf("PING SUCCESS! (took %v)\n", time.Since(start))
		}
		conn.Close()
	}
}
