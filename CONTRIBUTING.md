# Contributing

This repository contains Web, Skills, documentation, and distribution
integration. Keep changes within the component that owns the behavior:

- submit Web changes under `web/`;
- submit Codex plugin and Skill changes under `skills/`;
- submit root documentation and integration changes in this repository;
- submit Server implementation changes to
  [xfzen/apimind-server](https://github.com/xfzen/apimind-server), then update
  the pinned `server/` commit and compatibility manifest here.

Keep Chinese and English pages aligned, distinguish current capabilities from
Roadmap items, and use only official publisher sources. Browser code must not
call remote ApiMind, YApi, or business APIs directly; route those calls through
the Go service.

Before submitting a change, run:

```sh
make verify
```

For a narrower change, use `make test-docs`, `make test-web`,
`make test-skills`, or `make test-server`. The Server target requires the
pinned submodule.

Contributions to root files, `web/`, and `skills/` are distributed under
Apache License 2.0. Server contributions follow the licensing and contribution
terms of the Server repository.
