# octoherd-script: cleanup-archived-repos

> Close issues/PRs in archibed repositories
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/octoherd-script-cleanup-archived-repos \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

## Options

| option      | type    | description                               |
| ----------- | ------- | ----------------------------------------- |
| `--dry-run` | boolean | show what would be done (default `false`) |

## License

[MIT](license)
