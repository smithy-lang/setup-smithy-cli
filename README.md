# Setup Smithy CLI

A GitHub Action that installs the [Smithy CLI](https://smithy.io) onto your
Actions runner. It works on Linux, macOS, and Windows, caches the CLI binary
to avoid redundant downloads, and automatically caches Maven dependencies
when your `smithy-build.json` declares them.

## Usage

Add the action to any workflow step. The simplest form installs the latest
release:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: smithy-lang/setup-smithy-cli@v1
  - run: smithy build
```

To pin a specific version:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: smithy-lang/setup-smithy-cli@v1
    with:
      version: '1.56.0'
  - run: smithy build
```

If your `smithy-build.json` lives somewhere other than the repository root,
point the action at it so Maven dependency caching works correctly:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: smithy-lang/setup-smithy-cli@v1
    with:
      config: path/to/smithy-build.json
  - run: smithy build
```

The installed version is available as an output for downstream steps:

```yaml
steps:
  - uses: actions/checkout@v4
  - id: smithy
    uses: smithy-lang/setup-smithy-cli@v1
  - run: echo "Installed ${{ steps.smithy.outputs.cli-version }}"
```

## Inputs

| Name      | Required | Default | Description  |
|-----------|----------|---------|--------------|
| `version` | No       | Latest release      | Smithy CLI version to install. A leading `v` prefix is stripped automatically. |
| `config`  | No       | `smithy-build.json` | Path to `smithy-build.json` used for Maven dependency caching.               |

## Outputs

| Name          | Description                                     |
|---------------|-------------------------------------------------|
| `cli-version` | The resolved version string that was installed. |

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This project is licensed under the Apache-2.0 License.
