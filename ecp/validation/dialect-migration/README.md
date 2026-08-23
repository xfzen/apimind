# PostgreSQL/MySQL migration prototype

Applies equivalent reversible schemas to the pinned PostgreSQL and MySQL
images. The run verifies compound uniqueness, microsecond timestamps,
transaction rollback, least-privilege runtime grants, and a down/up cycle.
