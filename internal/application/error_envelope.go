package application

type ErrorEnvelope struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Retryable bool                   `json:"retryable"`
	Context   map[string]interface{} `json:"context,omitempty"`
}

func NewErrorEnvelope(code, message string, retryable bool, context map[string]interface{}) ErrorEnvelope {
	return ErrorEnvelope{
		Code:      code,
		Message:   message,
		Retryable: retryable,
		Context:   context,
	}
}
