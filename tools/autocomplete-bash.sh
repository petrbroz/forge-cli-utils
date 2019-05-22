#/usr/bin/env bash

configure () {
  echo "Configuring bash auto-completion for $1"
  DIR=$(dirname $BASH_SOURCE)
  COMMANDS=$(node $DIR/../src/$1.js -h | sed -e '1,/Commands/d' | awk -F '|' '{ gsub(/ +/, "", $1); print $1 }' | tr '\n' ' ')
  complete -W "$COMMANDS" $1
}

if [[ -z "$FORGE_CLIENT_ID" ]]; then
  FORGE_CLIENT_ID=foo
fi
if [[ -z "$FORGE_CLIENT_SECRET" ]]; then
  FORGE_CLIENT_SECRET=bar
fi

configure "forge-da"
configure "forge-dm"
configure "forge-md"
