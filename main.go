package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	zentroapp "zentro/internal/app"
	"zentro/internal/core"
	msdriver "zentro/internal/driver/mssql"
	pgdriver "zentro/internal/driver/postgres"

	// sql driver side-effect registrations
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/microsoft/go-mssqldb"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Pattern: Plugin/Module — register drivers here, decoupled from db/ and ui/.
	// Pattern: Factory Method — each New() returns a DatabaseDriver interface.
	core.Register(pgdriver.New())
	core.Register(msdriver.New())

	// Pattern: Singleton — one App instance for the lifetime of the process.
	app := zentroapp.NewApp()

	err := wails.Run(&options.App{
		Title:     "Zentro",
		Width:     1280,
		Height:    800,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 18, G: 18, B: 18, A: 1},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
