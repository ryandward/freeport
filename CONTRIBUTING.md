# Contributing to freeport

## Adding something to the tracker

Everything freeport tracks is a small file under `data/`.

- `data/projects/<id>.toml` is a project
- `data/changes/<id>.toml` is a PR, an MR, or a proposal that adds
  identity collection to a project
- `data/bills/<id>.toml` is a bill or a law

Copy a file that is close to what you are adding, change it, and open a
PR. The check on the PR tells you what is wrong if a field is missing,
misspelled, or points at a record that does not exist.

If the change is a PR on GitHub, an MR on gitlab.freedesktop.org or
gitlab.archlinux.org, or a PR on Codeberg, leave out `state`, `author`,
and `checked`. The bot reads those from the forge every 4 hours. For
anything else, such as a mailing list post, set all three yourself.

A `note` is about the change, not about the person who wrote it, and it
needs at least one link in `sources`.

To run the same check locally:

```
npm ci
node src/main.ts validate
```

## Code style

There is no style guide yet. Write clearly. Do not over-engineer.
