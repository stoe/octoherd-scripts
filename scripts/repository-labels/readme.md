# octoherd-script: repository-labels

> Sync labels across repositories
>
> [@octoherd](https://github.com/octoherd/) helps to keep your GitHub repositories in line.

## Usage

```sh
$ npx @stoe/octoherd-script-repository-labels \
  --template "stoe/octoherd-scripts"
  --octoherd-token ghp_000000000000000000000000000000000000 \
  --octoherd-repos "stoe/*"
```

## Options

| option       | type    | description                                       |
| ------------ | ------- | ------------------------------------------------- |
| `--dry-run`  | boolean | show what would be done (default `false`)         |
| `--defaults` | boolean | use [default labels](./labels.js)                 |
| `--path`     | string  | path to your labels.json ([example](labels.json)) |
| `--template` | string  | repository to sync labels from                    |

## License

[MIT](license)
