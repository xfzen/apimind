# Empty-environment backup/restore prototype

Creates real Casdoor fixture data through its API plus separate ECP and product
fixture databases. It stops the identity writer for a short read-only window,
uses publisher-supplied `mysqldump`/`pg_dump`, restores into empty databases,
and verifies identities, policy rows, product resources, and sequence
continuity. Backups are kept only in a private temporary directory.
