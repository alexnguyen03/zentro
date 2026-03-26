package plugin

type Capability string

const (
	CapabilityUICommands Capability = "ui.commands"
	CapabilityUIMenu     Capability = "ui.menu"
	CapabilityDataSource Capability = "data.providers"
)

type Manifest struct {
	ID            string       `json:"id"`
	Version       string       `json:"version"`
	MinAppVersion string       `json:"min_app_version"`
	Capabilities  []Capability `json:"capabilities"`
}

type CommandContribution struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	HandlerKey string `json:"handler_key"`
}

type DataProviderContribution struct {
	ID           string   `json:"id"`
	ResourceType []string `json:"resource_types"`
	QueryHook    string   `json:"query_hook"`
}

type Contribution struct {
	Manifest      Manifest                   `json:"manifest"`
	Commands      []CommandContribution      `json:"commands,omitempty"`
	DataProviders []DataProviderContribution `json:"data_providers,omitempty"`
	Metadata      map[string]string          `json:"metadata,omitempty"`
}
