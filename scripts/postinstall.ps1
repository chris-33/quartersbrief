$basepath = Join-Path -Path $PSScriptRoot -ChildPath ..

if (!(Test-Path "$basepath\tools\wowsunpack\wowsunpack.exe")) {
    New-Item -Path "$basepath\tools\wowsunpack" -ItemType "directory"
    Invoke-WebRequest "https://dl-wows-gc.wargaming.net/projects/mods/wowsunpack.exe" -outfile "$basepath\tools\wowsunpack\wowsunpack.exe"
}

if (!(Test-Path "$basepath\tools\gameparams2json\OneFileToRuleThemAll.py")) {
    New-Item -Path "$basepath\tools\gameparams2json" -ItemType "directory"
    Invoke-WebRequest "https://github.com/EdibleBug/WoWS-GameParams/tarball/master" -outfile "$basepath\tools\gameparams2json\gameparams2json.tar"
    tar -xf "$basepath\tools\gameparams2json\gameparams2json.tar" --strip-components=1 --directory="$basepath\tools\gameparams2json\"
    Remove-Item -Path "$basepath\tools\gameparams2json\gameparams2json.tar"
}