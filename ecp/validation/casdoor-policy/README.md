# Casdoor/Casbin policy prototype

Runs the pinned Casdoor and MySQL images, authenticates through Casdoor, creates
an isolated organization/application/user, and verifies direct grants, explicit
role grants, denial, and batch authorization. The fixture target is 100 batch
decisions; enterprise-specific sustained throughput remains an accepted G0
limit until the first production capacity profile is supplied.
