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

## Options

| option      | type    | description                               |
| ----------- | ------- | ----------------------------------------- |
| `--dry-run` | boolean | show what would be done (default `false`) |

## License

[MIT](license)
