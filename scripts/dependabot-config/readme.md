# octoherd-script: dependabot-config

> Apply [@dependabot](https://github.com/dependabot) config to all repositories
> ℹ️ https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically/configuration-options-for-dependency-updates
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/dependabot-config \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

## Options

| option      | type    | description                              |
| ----------- | ------- | ---------------------------------------- |
| `--dry-run` | boolean | show what would be done (default `false) |

## License

[MIT](license)
