# forge-cli-utils [![Build Status](https://travis-ci.org/petrbroz/forge-cli-utils.svg?branch=master)](https://travis-ci.org/petrbroz/forge-cli-utils) [![npm version](https://badge.fury.io/js/forge-cli-utils.svg)](https://badge.fury.io/js/forge-cli-utils)

Command line tools for Autodesk Forge services.

[![asciicast](https://asciinema.org/a/244057.svg)](https://asciinema.org/a/244057)

## Installation

### Using npm

Install the `forge-cli-utils` library, either in your own npm project
(`npm install --save forge-cli-utils`), or globally (`npm install --global forge-cli-utils`).

### Self-contained binaries

Scripts in this library are also packaged into self-contained binaries for various platforms
using the [pkg](https://www.npmjs.com/package/pkg) module. You can download the binaries from
[release](https://github.com/petrbroz/forge-cli-utils/releases) pages.

## Usage

### Providing Forge credentials

The CLI tools require Forge app credentials to be provided as env. variables.

> If you don't have a Forge app yet, check out this tutorial: https://forge.autodesk.com/en/docs/oauth/v2/tutorials/create-app/.

On macOS and linux:
```bash
export FORGE_CLIENT_ID=<your client id>
export FORGE_CLIENT_SECRET=<your client secret>
```

On Windows, using _cmd.exe_:
```
set FORGE_CLIENT_ID=<your client id>
set FORGE_CLIENT_SECRET=<your client secret>
```

On Windows, using PowerShell:
```powershell
$env:FORGE_CLIENT_ID = "<your client id>"
$env:FORGE_CLIENT_SECRET = "<your client secret>"
```

### Scripts

Use the following scripts for different Forge services:
  - `forge-dm` - [Forge Data Management](https://forge.autodesk.com/en/docs/data/v2) service
  - `forge-md` - [Forge Model Derivative](https://forge.autodesk.com/en/docs/model-derivative/v2) service
  - `forge-da` - [Forge Design Automation](https://forge.autodesk.com/en/docs/design-automation/v3) service

Each script expects a _subcommand_ similar to `git`. To get a list of all available commands,
run the script with `-h` or `--help`.

> When using bash, use the _tools/autocomplete-bash.sh_ script to setup a simple auto-completion
> for the basic commands of each script: `source tools/autocomplete-bash.sh`.

Most commands output raw JSON output from Forge services by default, but in many cases
you can use `-s` or `--short` flag to output a more concise version of the results.
The raw JSON output can also be combined with tools like [jq](https://stedolan.github.io/jq)
to extract just the pieces of information that you need:

```bash
# Listing buckets as full JSON
forge-dm list-buckets

# Listing bucket keys
forge-dm list-buckets --short

# List creation dates of all buckets
forge-dm list-buckets | jq '.[] | .createdDate'
```

### Examples

#### Data Management

```bash
# Listing buckets as full JSON
forge-dm list-buckets

# Listing object IDs of specific bucket
forge-dm list-objects my-test-bucket --short

# Listing object IDs without specifying a bucket (will show an interactive prompt with list of buckets to choose from)
forge-dm list-objects --short

# Getting an URN of an object
forge-dm object-urn my-bucket-key my-object-key
```

#### Design Automation

```bash
# Creating a new app bundle
forge-da create-appbundle BundleName path/to/bundle/zipfile Autodesk.Inventor+23 "Bundle description here."

# Updating existing activity
forge-da update-activity ActivityName BundleName BundleAlias Autodesk.Inventor+23 --input PartFile --output Thumbnail --output-local-name thumbnail.bmp

# Creating work item
forge-da create-workitem ActivityName ActivityAlias --input PartFile --input-url https://some.url --output Thumbnail --output-url https://another.url --short
```

> When specifying inputs and outputs for an activity or work item, `--input-*` and `--output-*` arguments
> are always applied to the last input/output ID. For example, consider the following sequence of arguments:
> `--input InputA --input-local-name house.rvt --input InputB --input InputC --input-url https://foobar.com`.
> Such a sequence will define three inputs: _InputA_ with local name _house.rvt_, _InputB_ (with no additional
> properties), and _InputC_ with URL _https://foobar.com_.

#### Model Derivative

```bash
# Translating a model based on its URN
forge-md translate dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6cG9jLWJvdXlndWVzLWltbW9iaWxpZXIvaW5wdXQucnZ0

# Showing an interactive prompt with all viewables in an URN, and then getting properties of the selected viewable
forge-md get-viewable-props dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6cG9jLWJvdXlndWVzLWltbW9iaWxpZXIvaW5wdXQucnZ0
```

> For additional examples, check out the _examples_ subfolder.
