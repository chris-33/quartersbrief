# Word of Warships Quarters Brief

This project is intended as an information tool for the popular video game [World of Warships](https://worldofwarships.eu/). While the game is easy enough to get started on, playing it well requires knowing a vast amount of information about ships' capabilities, quirks and technical data. Quartersbrief provides that information, restricted to that which is actually pertinent to the current battle, saving you the trouble of having to memorize half of the [World of Warships wiki](https://wiki.wargaming.net/en/World_of_Warships).

## Use

### Installing

#### On Linux (as a package)

The easiest way to install is through the .deb package provided with each release. Provided you already have added `i386` as a foreign architecture, and NodeJS is available in your package repositories in version 17 or higher, all you need to do is run 
```
sudo apt install ~/Downloads/quartersbrief_<x.y.z>_amd64.deb
```
replacing x.y.z with the version you downloaded.

To add `i386` as a foreign architecture, run:
```
sudo dpkg --add-architecture i386 && sudo apt update
```
before installing. 

NodeJS is available in the distro repositories, but usually in a version that is quite old. A newer PPA is maintained among others at [nodesource](https://github.com/nodesource/distributions/blob/master/README.md). To use it, run:
```
curl -fsSL https://deb.nodesource.com/setup_17.x | sudo -E bash -
```

#### On Windows (with installer)

The easiest way to install on Windows is through the installer provided with each release. Make sure that NodeJS and Python are added to your path.

#### On Linux (from source)

Quartersbrief depends on wine to perform automatic updates of its data whenever the game updates. Unfortunately, this makes the disk footprint quite large. If you don't want this, you can install from source and disable automatic updates. You will still need NodeJS v17 or higher. 

Download the source of the release and unzip it. Then run `npm install --production && npm link`. After that, run quartersbrief with the `--update-policy=never` option.

Fairly current game data can be downloaded from the [World of Warships Fitting Tool repository](https://github.com/EdibleBug/WoWSFT-Kotlin/tree/master/WoWSFT-Data/src/main/resources/json/live). Usually game updates are reflected here within a few days. Save these files to `~/.local/share/quartersbrief`. 

#### On Windows (from source)

You need to have NodeJS 17 or newer and Python 3 installed. Download and unzip the source of the release, then run `npm install --production` followed by `npm link`. 

### Configuring (program)

While all ways to configure quartersbrief are available as command-line options (run `quartersbrief --help`), the easiest way to configure is by editing the `quartersbrief.json` configuration file in the `quartersbrief` sub-folder of your user configuration directory. Most options are set to sensible defaults, but two in particular will probably require your attention:

1. `wowsdir`: Set this to your World of Warships root directory. (This is the directory that contains `WorldOfWarships.exe`.)
2. `application_id`: If you have a Wargaming.net API key, set it here. The program comes without a pre-configured one, because Wargaming forbids sharing API keys in their terms and conditions, so you will have to go through the trouble of obtaining one yourself if you want to see player information in your briefings.

### Configuring (agendas)

*Agendas* are the blueprints for the briefings delivered by quartersbrief. An agenda consists of two parts: a *matcher* describing what sort of battle the agenda is for, and a *topics* section detailing the topics to show. 

#### Matcher

The matcher begins with the header `[matches]`, followed by one or more lists for `ships`, `classes`, `tiers`, and `nations`. These describe the conditions the player's ship must satisfy for this agenda to be considered a match. These conditions are cumulative: If both `classes` and `tiers` is specified, for example, the player ship must satisfy both of them. Conditions that are not set, or set to an empty list(`[]`) are considered to be met regardless of the player ship, so not all of them need to be used in every agenda. 

Examples:
```
[matches]
classes = [ 'Cruiser', 'Destroyer' ]
tiers = [5, 6, 7, 8, 9, 10, 11 ]
```
This matches all cruisers and destroyers of tier 5 and up.
```
[matches]
ships = [ 'PASD021_Fletcher_1943', 'PASD013_Gearing_1945 ']
```
This will match only ships Fletcher and Gearing.
```
[matches]
classes = [ 'Battleship' ]
ships = [ 'PASD021_Fletcher_1943' ]
```
This will match nothing, because Fletcher is a destroyer.

If more than one agenda matches, quarterbrief's scoring system decides which one will actually be shown: Agendas are awarded points for how specific their matchers are. An agenda gets 10 points each for matching `classes`, `tiers`, and `nations`, and 100 points for matching `ships`. If there are several agendas with the same score, quartersbrief shows the first one it came across.

Example: 
```
[matches]
classes = [ 'Cruiser', 'Destroyer' ]
tiers = [5, 6, 7, 8, 9, 10, 11 ]
```
This agenda gets 20 points when it matches, 10 for matching the class and another 10 for matching the tier.
```
[matches]
ships = [ 'PASD021_Fletcher_1943', 'PASD013_Gearing_1945 ']
```
This agenda gets 100 points when it matches.
```
[matches]
ships = [ 'PASD021_Fletcher_1943', 'PASD013_Gearing_1945 ']
classes = [ 'Destroyer' ]
```
This agenda gets 110 points, even though it matches the same ships as the previous example.

#### Topics

The topics section begins with the header `[topics]`, followed by tables for the desired topics in the order they will be shown. Thus, an agenda wishing to show the hydro topic and the radar topic would look like this: 
```
[topics]

[topics.hydro]

[topics.radar]
```
In their respective section, topics may have configuration options, for example to specify what type of ship they should include. The following example restricts the hydro topic to enemy ships and sets the gap between radar range and ship detectability at which a ship will be considered to "almost" have a stealth radar capability to 500m:
```
[topics]

[topics.hydro]
filter = { teams: [ "enemies" ] }

[topics.radar]
almostThreshold = 500
```

### Running 

Run `quartersbrief --wowsdir <path/to/game>`, replacing `<path/to/game>` with the path to your World of Warships installation directory. To avoid having to pass this at every start, it can be set in `quartersbrief.json`.

After starting quartersbrief, direct your browser to `localhost:10000`.

## Development

### Cloning the project

```
git clone git@github.com:BadIdeaException/quartersbrief.git
npm install
```

This project is intended to be run inside a [Vagrant](https://www.vagrantup.com/) virtual machine to ensure a consistent, easily reproducable and readily replacable environment for tests and tryouts. To start this virtual machine, after cloning,
run 

``` 
vagrant up
```

### Running tests

```
npm test
```

Tests include integration testing that hits the actual live online Wargaming API. These require an API key. This can be provided in three ways:

1. By setting it in the environment variable `WG_APPLICATION_ID`
2. By passing it as an argument using `--application_id`. (Note: When using `npm`, you need to add a double hyphen `--` before this option, e.g. `npm test -- --application_id=12345`.)
3. By putting it in a file called `wg-application-id.secret` in the project's root folder. `*.secret` files are listed in `.gitignore`, so this is safe to do.

See [Wargaming.net Developer's Guide](https://developers.wargaming.net/documentation/guide/principles/) on how to get an application id.

### Starting

Run `node quartersbrief.js` to start the server, then navigate your browser to `localhost:10000`. The virtual machine exposes this port, so you can do it from the host.

With the development configuration, `quartersbrief` looks for World of Warhips in the folder `/opt/World_of_Warships` on the virtual machine. (Notice the underscores because of [this bug](https://github.com/hashicorp/vagrant/issues/12697).) You can create a folder called `wows` on the project's root folder, and it will get shared to that location. By putting a `tempArenaInfo.json` in a subfolder called `replays`, you can simulate a running battle. (The game generates this file whenever a battle is started and deletes it when the battle ends, so you can just copy it during the battle.)

### Debugging

The virtual machine exposes port 9229 to enable remote debugging from a graphical debugger. Run
```
npm run debug
```
(or `npm run debug-test` for debugging the tests).

There are also commands for using the built-in Node.js debugger. Append `-local` to `debug` for this, i.e. `npm run debug-local` or `npm run debug-local-test`.

### Releases

This project uses [grunt-bump](https://www.npmjs.com/package/grunt-bump) for handling releases. See there for detailed usage instructions. 

- `grunt bump:major` for a major release
- `grunt bump:minor` for a minor release
- `grunt bump:patch` for a patch release
- `grunt bump:prerelease` for a pre-release. (See also `prereleaseName` in [grunt task file](blob/master/grunt/bump.grunt.js).)

### Contributing and style guide

I am developing this project as a one-man show at the moment. If you have suggestions, feedback, or want to contribute, reach out through the issues. Pull requests are welcome, but expected to be fully tested and (obviously) passing.

In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality.