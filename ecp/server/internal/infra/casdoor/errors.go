package casdoor

import "fmt"

type Error struct {
	Reason     string
	StatusCode int
	Err        error
}

func (e *Error) Error() string {
	if e.Err == nil {
		return e.Reason
	}
	return fmt.Sprintf("%s: %v", e.Reason, e.Err)
}

func (e *Error) Unwrap() error { return e.Err }

func adapterError(reason string, status int, err error) error {
	return &Error{Reason: reason, StatusCode: status, Err: err}
}
