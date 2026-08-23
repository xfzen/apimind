package manifest

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
)

type Role struct {
	ID           string   `json:"id"`
	ResourceType string   `json:"resource_type"`
	Actions      []string `json:"actions"`
}

type Document struct {
	SchemaVersion string `json:"schema_version"`
	Roles         []Role `json:"roles"`
}

var IdentifierPattern = regexp.MustCompile(`^[a-z][a-z0-9_.:-]{0,127}$`)

func Parse(body []byte) (Document, error) {
	var value Document
	if err := json.Unmarshal(body, &value); err != nil || value.SchemaVersion == "" || len(value.Roles) == 0 {
		return Document{}, fmt.Errorf("manifest_roles_invalid")
	}
	seenRoles := make(map[string]struct{}, len(value.Roles))
	for index := range value.Roles {
		role := &value.Roles[index]
		if !IdentifierPattern.MatchString(role.ID) || !IdentifierPattern.MatchString(role.ResourceType) || len(role.Actions) == 0 {
			return Document{}, fmt.Errorf("manifest_roles_invalid")
		}
		if _, exists := seenRoles[role.ID]; exists {
			return Document{}, fmt.Errorf("manifest_roles_invalid")
		}
		seenRoles[role.ID] = struct{}{}
		actions := make(map[string]struct{}, len(role.Actions))
		for _, action := range role.Actions {
			if !IdentifierPattern.MatchString(action) {
				return Document{}, fmt.Errorf("manifest_roles_invalid")
			}
			actions[action] = struct{}{}
		}
		role.Actions = role.Actions[:0]
		for action := range actions {
			role.Actions = append(role.Actions, action)
		}
		sort.Strings(role.Actions)
	}
	return value, nil
}

func RoleMap(value Document) map[string]Role {
	roles := make(map[string]Role, len(value.Roles))
	for _, role := range value.Roles {
		roles[role.ID] = role
	}
	return roles
}
