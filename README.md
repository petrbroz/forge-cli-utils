# forge-cli

Command line tools for Autodesk Forge services.

[![asciicast](https://asciinema.org/a/Qo4m5MfUOG4hzXeZtewO6RcPd.svg)](https://asciinema.org/a/Qo4m5MfUOG4hzXeZtewO6RcPd)

## Examples

Listing buckets as full JSON:
`node src/forge-dm.js list-buckets`

Listing object IDs of specific bucket:
`node src/forge-dm.js list-objects my-test-bucket --short`

Listing object IDs without specifying a bucket (will show
an interactive prompt with list of buckets to choose from):
`node src/forge-dm.js list-objects --short`
