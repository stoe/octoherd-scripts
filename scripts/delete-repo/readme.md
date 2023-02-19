# octoherd-script: delete-repo

[![delete-repo version](https://img.shields.io/github/package-json/v/stoe/octoherd-scripts?filename=scripts%2Fdelete-repo%2Fpackage.json)](https://github.com/stoe/octoherd-scripts/pkgs/npm/octoherd-script-delete-repo)

> Delete repositories
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/octoherd-script-delete-repo \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

```sh
# to authenticate as GitHub App
$ npx @stoe/octoherd-script-delete-repo \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
  --app-id 12345 \
  --private-key ./private-key.pem
```

## Options

| option          | type    | description                                   |
| --------------- | ------- | --------------------------------------------- |
| `--dry-run`     | boolean | show what would be done (default `false`)     |
| `--app-id`      | integer | GitHub App ID (default `0`)                   |
| `--private-key` | string  | path to GitHub App `.pem` file (default `''`) |

## License

[MIT](license)
