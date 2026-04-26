package app

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// RedactSQLLiterals masks quoted literals to avoid storing sensitive values.
func RedactSQLLiterals(sql string) (string, string) {
	if strings.TrimSpace(sql) == "" {
		return "", ""
	}

	runes := []rune(sql)
	var out strings.Builder
	out.Grow(len(runes))

	inSingle := false
	inDouble := false

	for i := 0; i < len(runes); i++ {
		r := runes[i]

		if inSingle {
			if r == '\'' {
				if i+1 < len(runes) && runes[i+1] == '\'' {
					i++
					continue
				}
				inSingle = false
				out.WriteString("'<redacted>'")
			}
			continue
		}

		if inDouble {
			if r == '"' {
				if i+1 < len(runes) && runes[i+1] == '"' {
					i++
					continue
				}
				inDouble = false
				out.WriteString("\"<redacted>\"")
			}
			continue
		}

		if r == '\'' {
			inSingle = true
			continue
		}
		if r == '"' {
			inDouble = true
			continue
		}

		out.WriteRune(r)
	}

	masked := out.String()
	if inSingle || inDouble {
		// Preserve parse safety for broken SQL; never emit raw tail.
		masked += " <truncated_literal>"
	}

	sum := sha256.Sum256([]byte(sql))
	return masked, hex.EncodeToString(sum[:])
}
