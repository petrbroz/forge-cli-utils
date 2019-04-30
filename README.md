# forge-cli-utils [![Build Status](https://travis-ci.org/petrbroz/forge-cli-utils.svg?branch=master)](https://travis-ci.org/petrbroz/forge-cli-utils) [![npm version](https://badge.fury.io/js/forge-cli-utils.svg)](https://badge.fury.io/js/forge-cli-utils)

Command line tools for Autodesk Forge services.

[![asciicast](https://asciinema.org/a/242800.svg)](https://asciinema.org/a/242800)

## Examples

Listing buckets as full JSON:
`node src/forge-dm.js list-buckets`

Listing object IDs of specific bucket:
`node src/forge-dm.js list-objects my-test-bucket --short`

Listing object IDs without specifying a bucket (will show
an interactive prompt with list of buckets to choose from):
`node src/forge-dm.js list-objects --short`
