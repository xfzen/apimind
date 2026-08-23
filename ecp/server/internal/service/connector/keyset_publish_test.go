package connector

import (
	"os"
	"strings"
	"testing"
)

func TestKeySetMaintainerDoesNotOpenDatabaseOrHTTPListener(t *testing.T) {
	data, err := os.ReadFile("../../../cmd/keyset-maintain/main.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(data)
	for _, forbidden := range []string{"gorm.Open", "rest.MustNewServer", "http.ListenAndServe"} {
		if strings.Contains(source, forbidden) {
			t.Fatalf("maintainer contains %s", forbidden)
		}
	}
}
