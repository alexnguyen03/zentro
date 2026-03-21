package utils

import (
	"fmt"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "zentro"
	keyringApp     = "passwords"
)

func StorePassword(connectionName, password string) error {
	return keyring.Set(keyringService, connectionName, password)
}

func GetPassword(connectionName string) (string, error) {
	password, err := keyring.Get(keyringService, connectionName)
	if err != nil {
		if err == keyring.ErrNotFound {
			return "", nil
		}
		return "", fmt.Errorf("keyring get: %w", err)
	}
	return password, nil
}

func DeletePassword(connectionName string) error {
	err := keyring.Delete(keyringService, connectionName)
	if err == nil || err == keyring.ErrNotFound {
		return nil
	}
	return err
}

func DeleteAllPasswords(connectionNames []string) error {
	for _, name := range connectionNames {
		if err := DeletePassword(name); err != nil {
			return fmt.Errorf("delete password %s: %w", name, err)
		}
	}
	return nil
}
