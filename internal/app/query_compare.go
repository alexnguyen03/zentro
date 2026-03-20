package app

import (
	"fmt"
	"strings"
)

type QueryCompareService struct{}

func NewQueryCompareService() *QueryCompareService {
	return &QueryCompareService{}
}

func (s *QueryCompareService) CompareQueries(query1, query2 string) (string, error) {
	a := strings.Split(strings.ReplaceAll(query1, "\r\n", "\n"), "\n")
	b := strings.Split(strings.ReplaceAll(query2, "\r\n", "\n"), "\n")
	if len(strings.TrimSpace(query1)) == 0 && len(strings.TrimSpace(query2)) == 0 {
		return "", fmt.Errorf("compare: both queries are empty")
	}

	ops := lcsDiff(a, b)
	var out strings.Builder
	out.WriteString("--- query1\n")
	out.WriteString("+++ query2\n")
	for _, op := range ops {
		switch op.kind {
		case "eq":
			out.WriteString(" ")
			out.WriteString(op.text)
			out.WriteString("\n")
		case "del":
			out.WriteString("-")
			out.WriteString(op.text)
			out.WriteString("\n")
		case "add":
			out.WriteString("+")
			out.WriteString(op.text)
			out.WriteString("\n")
		}
	}
	return strings.TrimRight(out.String(), "\n"), nil
}

type diffOp struct {
	kind string
	text string
}

func lcsDiff(a, b []string) []diffOp {
	n := len(a)
	m := len(b)
	dp := make([][]int, n+1)
	for i := range dp {
		dp[i] = make([]int, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		for j := m - 1; j >= 0; j-- {
			if a[i] == b[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] >= dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}

	var ops []diffOp
	i, j := 0, 0
	for i < n && j < m {
		if a[i] == b[j] {
			ops = append(ops, diffOp{kind: "eq", text: a[i]})
			i++
			j++
			continue
		}
		if dp[i+1][j] >= dp[i][j+1] {
			ops = append(ops, diffOp{kind: "del", text: a[i]})
			i++
		} else {
			ops = append(ops, diffOp{kind: "add", text: b[j]})
			j++
		}
	}
	for i < n {
		ops = append(ops, diffOp{kind: "del", text: a[i]})
		i++
	}
	for j < m {
		ops = append(ops, diffOp{kind: "add", text: b[j]})
		j++
	}
	return ops
}
