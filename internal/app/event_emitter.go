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

func EmitVersionedEvent(emitter EventEmitter, ctx context.Context, eventV1, eventV2 string, payload any) {
	emitter.Emit(ctx, eventV1, toLegacyEventPayload(payload))
	if eventV2 == "" {
		return
	}
	emitter.Emit(ctx, eventV2, payload)
}

func toLegacyEventPayload(payload any) any {
	switch p := payload.(type) {
	case ConnectionChangedEvent:
		return map[string]any{
			"profile": p.Profile,
			"status":  p.Status,
		}
	case SchemaDatabasesEvent:
		return map[string]any{
			"profileName": p.ProfileName,
			"databases":   p.Databases,
		}
	case SchemaErrorEvent:
		return map[string]any{
			"profileName": p.ProfileName,
			"dbName":      p.DBName,
			"error":       p.Error,
		}
	case SchemaLoadedEvent:
		return map[string]any{
			"profileName": p.ProfileName,
			"dbName":      p.DBName,
			"schemas":     p.Schemas,
		}
	case QueryStartedEvent:
		return map[string]any{
			"tabID":          p.TabID,
			"sourceTabID":    p.SourceTabID,
			"query":          p.Query,
			"statementText":  p.StatementText,
			"statementIndex": p.StatementIndex,
			"statementCount": p.StatementCount,
		}
	case QueryChunkEvent:
		legacy := map[string]any{
			"tabID":          p.TabID,
			"sourceTabID":    p.SourceTabID,
			"rows":           p.Rows,
			"seq":            p.Seq,
			"statementIndex": p.StatementIndex,
			"statementCount": p.StatementCount,
			"statementText":  p.StatementText,
		}
		if len(p.Columns) > 0 {
			legacy["columns"] = p.Columns
		}
		if p.TableName != "" {
			legacy["tableName"] = p.TableName
		}
		if len(p.PrimaryKeys) > 0 {
			legacy["primaryKeys"] = p.PrimaryKeys
		}
		return legacy
	case QueryDoneEvent:
		legacy := map[string]any{
			"tabID":          p.TabID,
			"sourceTabID":    p.SourceTabID,
			"affected":       p.Affected,
			"duration":       p.Duration,
			"isSelect":       p.IsSelect,
			"hasMore":        p.HasMore,
			"statementIndex": p.StatementIndex,
			"statementCount": p.StatementCount,
			"statementText":  p.StatementText,
		}
		if p.Error != "" {
			legacy["error"] = p.Error
		}
		return legacy
	case TransactionStatusEvent:
		legacy := map[string]any{
			"status": p.Status,
			"driver": p.Driver,
		}
		if p.Error != "" {
			legacy["error"] = p.Error
		}
		return legacy
	default:
		return payload
	}
}
