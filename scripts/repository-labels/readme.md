# octoherd-script: repository-labels

[![repository-labels version](https://img.shields.io/github/package-json/v/stoe/octoherd-scripts?filename=scripts%2Frepository-labels%2Fpackage.json)](https://github.com/stoe/octoherd-scripts/pkgs/npm/octoherd-script-repository-labels)

> Sync labels across repositories
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/octoherd-script-repository-labels \
  --template "stoe/octoherd-scripts" \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

```sh
# to authenticate as GitHub App
$ npx @stoe/octoherd-script-repository-labels \
  --template "stoe/octoherd-scripts" \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
  --app-id 12345 \
  --private-key ./private-key.pem
```

## Options

| option          | type    | description                                       |
| --------------- | ------- | ------------------------------------------------- |
| `--defaults`    | boolean | use [default labels](./labels.js)                 |
| `--path`        | string  | path to your labels.json ([example](labels.json)) |
| `--template`    | string  | repository to sync labels from                    |
| `--dry-run`     | boolean | show what would be done (default `false`)         |
| `--app-id`      | integer | GitHub App ID (default `0`)                       |
| `--private-key` | string  | path to GitHub App `.pem` file (default `''`)     |

## License

[MIT](license)
