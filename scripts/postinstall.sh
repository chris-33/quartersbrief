#!/bin/bash

basepath=$(realpath -s "$(dirname ${BASH_SOURCE[0]:-$0})/..")

# Install wowsunpack.exe if it doesn't already exist
if [[ ! -e "$basepath/tools/wowsunpack/wowsunpack.exe" ]]; then
	mkdir -p "$basepath/tools/wowsunpack" && curl -o "$basepath/tools/wowsunpack/wowsunpack.exe" https://dl-wows-gc.wargaming.net/projects/mods/wowsunpack.exe
fi

# Install tool to convert GameParams.data to GameParams.json
if [[ ! -e "$basepath/tools/gameparams2json/OneFileToRuleThemAll.py" ]]; then
	mkdir -p "$basepath/tools/gameparams2json" && curl -L https://github.com/EdibleBug/WoWS-GameParams/tarball/master | tar xz -C "$basepath/tools/gameparams2json/" --strip-components=1
fi