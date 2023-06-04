# octoherd-script: repository-secrets

[![repository-secrets version](https://img.shields.io/github/package-json/v/stoe/octoherd-scripts?filename=scripts%2Frepository-secrets%2Fpackage.json)](https://github.com/stoe/octoherd-scripts/pkgs/npm/octoherd-script-repository-secrets)

> Manage repository Action secrets and variables
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/octoherd-script-repository-secrets \
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*" \
  --path .secrets.yml
```

## Options

| option      | type    | description                                                                 |
| ----------- | ------- | --------------------------------------------------------------------------- |
| `--dry-run` | boolean | show what would be done (default `false`)                                   |
| `--path`    | string  | path to the secrets file in YAML format, see below (default `.secrets.yml`) |

`.secrets.yml` format

```yaml
# .secrets.yml
secrets:
  SECRET_NAME: value
  ANOTHER_SECRET: value

variables:
  VARIABLE_NAME: value
  ANOTHER_VARIABLE: value
```

## License

[MIT](license)
