#!/usr/bin/env bash

set -e

# update function
ncu() {
  npx --no-install npm-check-updates -u
  npm install --ignore-scripts
}

for D in scripts/*; do
  if [ -d "${D}" ]; then
    pushd "${D}"
      ncu
    pushd
  fi
done

ncu

npm run format --if-present
npm run build --if-present
npm run test --if-present
