package app

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EventEmitter abstracts event emission so services can be tested without Wails runtime.
type EventEmitter interface {
	Emit(ctx context.Context, eventName string, payload any)
}

type wailsEventEmitter struct{}

func NewWailsEventEmitter() EventEmitter {
	return wailsEventEmitter{}
}

func (w wailsEventEmitter) Emit(ctx context.Context, eventName string, payload any) {
	if payload == nil {
		runtime.EventsEmit(ctx, eventName)
		return
	}
	runtime.EventsEmit(ctx, eventName, payload)
}
