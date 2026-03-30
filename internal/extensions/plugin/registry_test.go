package plugin

import "testing"

func TestRegistryRegisterAndResolve(t *testing.T) {
	reg := NewInMemoryRegistry()
	err := reg.Register(Contribution{
		Manifest: Manifest{
			ID:            "sample.plugin",
			Version:       "1.0.0",
			MinAppVersion: "0.2.0",
			Capabilities:  []Capability{CapabilityUICommands},
		},
	})
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	item, ok := reg.Resolve("sample.plugin")
	if !ok {
		t.Fatal("expected plugin to exist")
	}
	if item.Manifest.ID != "sample.plugin" {
		t.Fatalf("unexpected plugin id: %s", item.Manifest.ID)
	}
}

func TestRegistryListByCapability(t *testing.T) {
	reg := NewInMemoryRegistry()
	_ = reg.Register(Contribution{
		Manifest: Manifest{
			ID:            "commands.plugin",
			Version:       "1.0.0",
			MinAppVersion: "0.2.0",
			Capabilities:  []Capability{CapabilityUICommands},
		},
	})
	_ = reg.Register(Contribution{
		Manifest: Manifest{
			ID:            "provider.plugin",
			Version:       "1.0.0",
			MinAppVersion: "0.2.0",
			Capabilities:  []Capability{CapabilityDataSource},
		},
	})

	list := reg.ListByCapability(CapabilityUICommands)
	if len(list) != 1 {
		t.Fatalf("expected 1 plugin, got %d", len(list))
	}
}
