#!/bin/bash

basepath=$(realpath -s "$(dirname ${BASH_SOURCE[0]:-$0})/..")

# Install wowsunpack.exe if it doesn't already exist
if [[ ! -e "$basepath/tools/wowsunpack/wowsunpack.exe" ]]; then
	echo "Installing wowsunpack.exe..."
	# Primary download link https://dl-wows-gc.wargaming.net/projects/mods/wowsunpack.exe appears to be broken - wowsunpack always errors.
	# Using alternate download link.
	mkdir --parents "$basepath/tools/wowsunpack" && curl --silent --output "$basepath/tools/wowsunpack/wowsunpack.exe" https://gitlab.com/AutoSpy/wowsut/raw/master/wowsunpack.exe
else
	echo "wowsunpack.exe is already installed."
fi

# Install tool to convert GameParams.data to GameParams.json
if [[ ! -e "$basepath/tools/gameparams2json/OneFileToRuleThemAll.py" ]]; then
	echo "Installing tool to convert GameParams.data to GameParams.json..."
	mkdir --parents "$basepath/tools/gameparams2json" && curl --silent --location https://github.com/EdibleBug/WoWS-GameParams/tarball/master | tar --extract --gunzip --directory="$basepath/tools/gameparams2json/" --strip-components=1
else
	echo "Tool to convert GameParams.data to GameParams.json is already installed."
fi