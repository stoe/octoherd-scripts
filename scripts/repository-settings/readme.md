# octoherd-script: repo-settings

> Apply my default respository settings
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/repo-settings \
  --template "stoe/repo-settings"
```

Pass all options as CLI flags to avoid user prompts

```sh
$ npx @stoe/repo-settings \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

## Options

| option      | type    | description                              |
| ----------- | ------- | ---------------------------------------- |
| `--dry-run` | boolean | show what would be done (default `false) |

## License

[MIT](license)
