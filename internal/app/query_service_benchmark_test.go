package app

import "testing"

func BenchmarkScanValueToString_UUID(b *testing.B) {
	raw := []byte{
		0x67, 0x45, 0x23, 0x01,
		0xab, 0x89,
		0xef, 0xcd,
		0x01, 0x23,
		0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = scanValueToString(raw)
	}
}

func BenchmarkScanValueToString_Int(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = scanValueToString(int64(i))
	}
}
