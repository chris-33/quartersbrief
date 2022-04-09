$basepath = Join-Path -Path $PSScriptRoot -ChildPath ..

if (Test-Path "$basepath\tools\wowsunpack\wowsunpack.exe") {
    echo "wowsunpack.exe is already installed"
} else {
    echo "Installing wowsunpack.exe..."
    New-Item -Path "$basepath\tools\wowsunpack" -ItemType "directory" -ErrorAction Ignore | Out-Null
    Invoke-WebRequest "https://dl-wows-gc.wargaming.net/projects/mods/wowsunpack.exe" -outfile "$basepath\tools\wowsunpack\wowsunpack.exe" | Out-Null
}

if (Test-Path "$basepath\tools\gameparams2json\OneFileToRuleThemAll.py") {
    echo "Tool to convert GameParams.data to GameParams.json is already installed."
} else {
    echo "Installing tool to convert GameParams.data to GameParams.json..."
    New-Item -Path "$basepath\tools\gameparams2json" -ItemType "directory" -ErrorAction Ignore | Out-Null
    Invoke-WebRequest "https://github.com/EdibleBug/WoWS-GameParams/tarball/master" -outfile "$basepath\tools\gameparams2json\gameparams2json.tar" | Out-Null
    tar -xf "$basepath\tools\gameparams2json\gameparams2json.tar" --strip-components=1 --directory="$basepath\tools\gameparams2json" | Out-Null
    Remove-Item -Path "$basepath\tools\gameparams2json\gameparams2json.tar" | Out-Null
}