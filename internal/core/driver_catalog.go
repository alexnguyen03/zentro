package core

type DriverDescriptor struct {
	Name         string   `json:"name"`
	Capabilities []string `json:"capabilities"`
}

func DriverDescriptors() []DriverDescriptor {
	drivers := All()
	out := make([]DriverDescriptor, 0, len(drivers))
	for _, d := range drivers {
		out = append(out, DriverDescriptor{
			Name: d.Name(),
			Capabilities: []string{
				"connector",
				"schema.fetch",
				"query.dialect",
			},
		})
	}
	return out
}
