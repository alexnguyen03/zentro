package app

import (
	"fmt"
	"strings"
	"time"

	"zentro/internal/constant"
)

func (s *QueryService) emitDone(statement queryStatement, affected int64, duration time.Duration, isSelect bool, err error) {
	s.emitDoneWithMore(statement, affected, duration, isSelect, false, err)
}

func (s *QueryService) emitDoneWithMore(statement queryStatement, affected int64, duration time.Duration, isSelect bool, hasMore bool, err error) {
	payload := QueryDoneEvent{
		TabID:          statement.TabID,
		SourceTabID:    statement.SourceTabID,
		Affected:       affected,
		Duration:       duration.Milliseconds(),
		IsSelect:       isSelect,
		HasMore:        hasMore,
		StatementIndex: statement.Index,
		StatementCount: statement.Count,
		StatementText:  statement.Text,
	}
	if err != nil {
		payload.Error = err.Error()
	}
	EmitVersionedEvent(s.emitter, s.ctx, constant.EventQueryDone, constant.EventQueryDoneV2, payload)
}

func buildChunk(statement queryStatement, cols []string, rows [][]string, seq int, tableName string, pks []string) QueryChunkEvent {
	chunk := QueryChunkEvent{
		TabID:          statement.TabID,
		SourceTabID:    statement.SourceTabID,
		Rows:           rows,
		Seq:            seq,
		StatementIndex: statement.Index,
		StatementCount: statement.Count,
		StatementText:  statement.Text,
	}
	if cols != nil {
		chunk.Columns = cols
	}
	if tableName != "" {
		chunk.TableName = tableName
	}
	if len(pks) > 0 {
		chunk.PrimaryKeys = pks
	}
	return chunk
}

func resultTabID(sourceTabID string, statementIndex int) string {
	if statementIndex <= 0 {
		return sourceTabID
	}
	return fmt.Sprintf("%s::result:%d", sourceTabID, statementIndex+1)
}

func sourceTabID(tabID string) string {
	parts := strings.Split(tabID, "::result:")
	if len(parts) == 2 {
		return parts[0]
	}
	return tabID
}
