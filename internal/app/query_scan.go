package app

import (
	"database/sql"
	"encoding/hex"
	"fmt"
	"strconv"
	"sync"
)

func scanRowAsStrings(rows *sql.Rows, colCount int) []string {
	raw, ptrs := acquireScanBuffers(colCount)
	defer releaseScanBuffers(raw, ptrs)
	_ = rows.Scan(ptrs...)

	result := make([]string, colCount)
	for i, v := range raw {
		if v == nil {
			result[i] = ""
		} else {
			result[i] = scanValueToString(v)
		}
	}
	return result
}

var scanRawPool = sync.Pool{
	New: func() any { return make([]interface{}, 0, 32) },
}

var scanPtrPool = sync.Pool{
	New: func() any { return make([]interface{}, 0, 32) },
}

func acquireScanBuffers(colCount int) ([]interface{}, []interface{}) {
	raw := scanRawPool.Get().([]interface{})
	ptrs := scanPtrPool.Get().([]interface{})

	if cap(raw) < colCount {
		raw = make([]interface{}, colCount)
	} else {
		raw = raw[:colCount]
		for i := range raw {
			raw[i] = nil
		}
	}

	if cap(ptrs) < colCount {
		ptrs = make([]interface{}, colCount)
	} else {
		ptrs = ptrs[:colCount]
	}

	for i := range raw {
		ptrs[i] = &raw[i]
	}
	return raw, ptrs
}

func releaseScanBuffers(raw []interface{}, ptrs []interface{}) {
	for i := range raw {
		raw[i] = nil
	}
	for i := range ptrs {
		ptrs[i] = nil
	}
	scanRawPool.Put(raw[:0])
	scanPtrPool.Put(ptrs[:0])
}

func scanValueToString(v interface{}) string {
	switch tv := v.(type) {
	case []byte:
		if len(tv) == 16 {
			return formatSQLServerUUID(tv)
		}
		return string(tv)
	case string:
		return tv
	case int:
		return strconv.Itoa(tv)
	case int8:
		return strconv.FormatInt(int64(tv), 10)
	case int16:
		return strconv.FormatInt(int64(tv), 10)
	case int32:
		return strconv.FormatInt(int64(tv), 10)
	case int64:
		return strconv.FormatInt(tv, 10)
	case uint:
		return strconv.FormatUint(uint64(tv), 10)
	case uint8:
		return strconv.FormatUint(uint64(tv), 10)
	case uint16:
		return strconv.FormatUint(uint64(tv), 10)
	case uint32:
		return strconv.FormatUint(uint64(tv), 10)
	case uint64:
		return strconv.FormatUint(tv, 10)
	case float32:
		return strconv.FormatFloat(float64(tv), 'g', -1, 32)
	case float64:
		return strconv.FormatFloat(tv, 'g', -1, 64)
	case bool:
		return strconv.FormatBool(tv)
	default:
		return fmt.Sprint(v)
	}
}

func formatSQLServerUUID(b []byte) string {
	if len(b) != 16 {
		return string(b)
	}

	ordered := [16]byte{
		b[3], b[2], b[1], b[0],
		b[5], b[4],
		b[7], b[6],
		b[8], b[9],
		b[10], b[11], b[12], b[13], b[14], b[15],
	}

	dst := make([]byte, 36)
	hex.Encode(dst[0:8], ordered[0:4])
	dst[8] = '-'
	hex.Encode(dst[9:13], ordered[4:6])
	dst[13] = '-'
	hex.Encode(dst[14:18], ordered[6:8])
	dst[18] = '-'
	hex.Encode(dst[19:23], ordered[8:10])
	dst[23] = '-'
	hex.Encode(dst[24:36], ordered[10:16])
	return string(dst)
}
