#!/usr/bin/env bats

@test "Forge credentials available" {
  [ "$FORGE_CLIENT_ID" != "" ]
  [ "$FORGE_CLIENT_SECRET" != "" ]
}

@test "Show help" {
  result1="$(forge-dm)"
  [ "$result1" != "" ]
  result2="$(forge-dm -h)"
  [ "$result1" == "$result2" ]
}

@test "List buckets" {
  result1="$(forge-dm list-buckets | jq -r '.[] | .bucketKey')"
  [ "$result1" != "" ]
  result2="$(forge-dm lb --short)"
  [ "$result1" == "$result2" ]
}
