package app

import (
	"zentro/internal/core"
	"zentro/internal/extensions/license"
	pluginext "zentro/internal/extensions/plugin"
)

func (a *App) RegisterPluginContribution(c pluginext.Contribution) error {
	return a.pluginRegistry.Register(c)
}

func (a *App) ResolvePluginContribution(id string) (pluginext.Contribution, bool) {
	return a.pluginRegistry.Resolve(id)
}

func (a *App) ListPluginByCapability(capability string) []pluginext.Contribution {
	return a.pluginRegistry.ListByCapability(pluginext.Capability(capability))
}

func (a *App) ActivateLicense(key string, deviceInfo string) (license.State, error) {
	return a.licenseService.ActivateLicense(key, deviceInfo)
}

func (a *App) RefreshLicense(sessionToken string) (license.State, error) {
	return a.licenseService.RefreshLicense(sessionToken)
}

func (a *App) DeactivateLicense(reason string) error {
	return a.licenseService.DeactivateLicense(reason)
}

func (a *App) GetLicenseState() (license.State, error) {
	return a.licenseService.GetLicenseState()
}

func (a *App) ListDriverDescriptors() []core.DriverDescriptor {
	return core.DriverDescriptors()
}
