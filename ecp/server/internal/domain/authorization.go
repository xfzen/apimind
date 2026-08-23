package domain

import "time"

type AuthorizationRequest struct {
	EnterpriseID, ApplicationInstanceID, PrincipalID, PrincipalKind, IdentityProvider string
	PolicySubject                                                                     string
	DirectGroupIDs                                                                    []string
	DirectGroupVersion                                                                uint64
	Action, ResourceID, PermissionID                                                  string
	ResourceVersion                                                                   uint64
	SessionRevoked                                                                    bool
}

type AuthorizationDecision struct {
	Allow                                                                                                  bool   `json:"allow"`
	Reason                                                                                                 string `json:"reason"`
	LifecycleVersion, IdentitySyncVersion, PolicyVersion, AuthorizedResourceVersion, SecurityConfigVersion uint64
	IdentityFreshnessDeadline                                                                              time.Time
}

type AuthorizationIdentity struct {
	PrincipalKind      string
	IdentityProvider   string
	PolicySubject      string
	DirectGroupIDs     []string
	DirectGroupVersion uint64
}

type AccessState struct {
	LifecycleState                        string
	LifecycleVersion, IdentitySyncVersion uint64
	IdentityFreshnessDeadline             time.Time
}

type DelegationState struct {
	PolicyVersion             uint64
	LifecycleVersion          uint64
	IdentitySyncVersion       uint64
	IdentityFreshnessDeadline time.Time
}
