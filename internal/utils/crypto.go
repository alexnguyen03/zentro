package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)

const configKeyName = "zentro_config_key"

func getOrCreateConfigKey() ([]byte, error) {
	key, err := GetPassword(configKeyName)
	if err == nil && key != "" {
		keyBytes, err := hex.DecodeString(key)
		if err == nil && len(keyBytes) == 32 {
			return keyBytes, nil
		}
	}

	var keyBytes [32]byte
	if _, err := rand.Read(keyBytes[:]); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}

	keyHex := hex.EncodeToString(keyBytes[:])
	if err := StorePassword(configKeyName, keyHex); err != nil {
		return nil, fmt.Errorf("store config key: %w", err)
	}

	return keyBytes[:], nil
}

func encryptConfig(data []byte) ([]byte, error) {
	key, err := getOrCreateConfigKey()
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes new: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm new: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("nonce: %w", err)
	}

	encrypted := gcm.Seal(nonce, nonce, data, nil)
	return encrypted, nil
}

func decryptConfig(data []byte) ([]byte, error) {
	key, err := getOrCreateConfigKey()
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes new: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm new: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, fmt.Errorf("data too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}

func configFilePath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("config dir: %w", err)
	}
	dir := filepath.Join(base, "zentro")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("mkdir: %w", err)
	}
	return filepath.Join(dir, "config.json"), nil
}
