# octoherd-script: release-config

> Apply release config to all repositories
> ℹ️ https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes#configuring-automatically-generated-release-notes
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx   @stoe/octoherd-script-action-node-version \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

```sh
# to authenticate as GitHub App
$ npx @stoe/octoherd-script-action-node-version \
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
