package utils

import (
	"context"
	"io"
	"log/slog"
	"os"
)

// NewLogger khởi tạo slog.Logger.
// logToFile=true sẽ ghi thêm JSON log vào file "zentro.log".
// Nếu không mở được file, fallback về stderr-only.
func NewLogger(logToFile bool) *slog.Logger {
	textHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})

	if !logToFile {
		return slog.New(textHandler)
	}

	f, err := os.OpenFile("zentro.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		// fallback: chỉ stderr
		return slog.New(textHandler)
	}

	fileHandler := slog.NewJSONHandler(f, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	return slog.New(newMultiHandler(textHandler, fileHandler))
}

// multiHandler fan-out log records ra nhiều handlers.
type multiHandler struct {
	handlers []slog.Handler
}

func newMultiHandler(handlers ...slog.Handler) slog.Handler {
	return &multiHandler{handlers: handlers}
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	var lastErr error
	for _, h := range m.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r); err != nil {
				lastErr = err
			}
		}
	}
	return lastErr
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newHandlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		newHandlers[i] = h.WithAttrs(attrs)
	}
	return newMultiHandler(newHandlers...)
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
	newHandlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		newHandlers[i] = h.WithGroup(name)
	}
	return newMultiHandler(newHandlers...)
}

// Compile-time check: multiHandler implements slog.Handler.
var _ slog.Handler = (*multiHandler)(nil)

// discard là io.Writer rỗng — dùng khi cần suppress output.
var discard io.Writer = io.Discard
