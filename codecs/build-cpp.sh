#!/bin/sh -e
docker build -t squash-cpp - < ../cpp.Dockerfile
docker run --rm -v $PWD:/src squash-cpp "$@"
node "$(dirname "$0")/generate-version-metadata.mjs"
