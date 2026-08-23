package main

import (
	"flag"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	listen := flag.String("listen", ":4001", "listen address")
	directory := flag.String("dir", "./dist", "UI distribution directory")
	apiURL := flag.String("api", "http://127.0.0.1:18890", "ECP API upstream")
	flag.Parse()
	upstream, err := url.Parse(*apiURL)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(upstream)
	files := http.FileServer(http.Dir(*directory))
	handler := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if strings.HasPrefix(request.URL.Path, "/api/") {
			proxy.ServeHTTP(response, request)
			return
		}
		path := filepath.Join(*directory, filepath.Clean(request.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			files.ServeHTTP(response, request)
			return
		}
		http.ServeFile(response, request, filepath.Join(*directory, "index.html"))
	})
	log.Printf("ECP UI listening on %s", *listen)
	log.Fatal(http.ListenAndServe(*listen, handler))
}
