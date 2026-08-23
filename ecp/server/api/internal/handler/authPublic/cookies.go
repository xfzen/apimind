package authPublic

import "net/http"

const (
	transactionIDCookie = "ecp_oidc_transaction"
	verifierCookie      = "ecp_oidc_verifier"
	nonceCookie         = "ecp_oidc_nonce"
	adminCSRFCookie     = "ecp_admin_csrf"
)

func setCookie(response http.ResponseWriter, name, value, path string, maxAge int, secure, httpOnly bool, sameSite http.SameSite) {
	http.SetCookie(response, &http.Cookie{Name: name, Value: value, Path: path, MaxAge: maxAge, Secure: secure, HttpOnly: httpOnly, SameSite: sameSite})
}

func cookieValue(request *http.Request, name string) (string, error) {
	value, err := request.Cookie(name)
	if err != nil {
		return "", err
	}
	return value.Value, nil
}
