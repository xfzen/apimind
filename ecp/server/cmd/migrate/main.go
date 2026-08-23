package main

import (
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/xfzen/ecp/server/internal/migration"
)

func main() {
	driver := flag.String("driver", "", "database driver: postgres or mysql")
	dsn := flag.String("dsn", "", "schema-owner migration DSN")
	dsnFile := flag.String("dsn-file", "", "file containing schema-owner migration DSN")
	flag.Parse()
	if *dsn == "" && *dsnFile != "" {
		value, err := os.ReadFile(*dsnFile)
		if err != nil {
			fatalf("read DSN file: %v", err)
		}
		*dsn = strings.TrimSpace(string(value))
	}
	if *driver == "" || *dsn == "" || flag.NArg() < 1 {
		fatalf("usage: migrate -driver DRIVER -dsn DSN up|down|version [steps]")
	}
	switch flag.Arg(0) {
	case "up":
		if err := migration.Up(*driver, *dsn); err != nil {
			fatalf("%v", err)
		}
	case "down":
		steps := 1
		if flag.NArg() == 2 {
			parsed, err := strconv.Atoi(flag.Arg(1))
			if err != nil {
				fatalf("invalid down steps: %v", err)
			}
			steps = parsed
		}
		if err := migration.Down(*driver, *dsn, steps); err != nil {
			fatalf("%v", err)
		}
	case "version":
		version, dirty, err := migration.Version(*driver, *dsn)
		if err != nil {
			fatalf("%v", err)
		}
		fmt.Printf("version=%d dirty=%v\n", version, dirty)
	default:
		fatalf("unknown migration command %q", flag.Arg(0))
	}
}

func fatalf(format string, values ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
