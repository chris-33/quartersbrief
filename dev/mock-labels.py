#!/usr/bin/env python3
import sys
import polib
import json
import os

# This script generates fixtures for update-labels.spec.js
# It takes a JSON dictionary of message keys and message strings and turns them into a GNU gettext .mo file.

if len(sys.argv) < 2:
	print('Error: no infile specified.\nYou need to pass the name of a file in .json format to convert to GameParams.data')
	exit(1)
else:
	infile = sys.argv[1]

outfile = os.path.join(os.path.dirname(infile), os.path.splitext(os.path.basename(infile))[0] + '.mo')

# Read the data from the infile
with open(infile, 'r') as f:
	data = json.load(f)

po = polib.POFile()
po.metadata = {
	'Content-Type': 'text/plain; charset=utf-8',
	'Plural-Forms': 'nplurals=2; plural=n != 1;'
}

for msgid, msgstr in data.items():
	# Verify that msgstr is in fact a string:
	if not isinstance(msgstr, str):
		print('Error: Translation value for ' + msgid + ' is not a string')
		exit(1)

	entry = polib.POEntry(msgid=msgid, msgstr=msgstr)
	po.append(entry)

po.save_as_mofile(outfile)