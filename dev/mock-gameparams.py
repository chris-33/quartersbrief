#!/usr/bin/env python3
import sys
import pickle
import zlib
import json
import importlib
import os

# This script generates fixtures for update-gameparams.spec.js
# It takes a JSON file and creates a mock GameParams.data from the data contained therein.

if len(sys.argv) < 2:
	print('Error: no infile specified.\nYou need to pass the name of a file in .json format to convert to GameParams.data')
	exit(1)
else:
	infile = sys.argv[1]

# The following lines will dynamically create a module called GameParams and add the required classes to it
# It is the same as importing a module GameParams.py of the following contents:
# 	class TypeInfo(object): pass
# 	class GPData(object): pass
# 	class GameParams: pass
# 	class UIParams: pass
# The advantage of doing it this way is that it keeps the script self-contained.
#
# Here goes:
# 
# 1. Programatically create a module called GameParams
GameParams = importlib.util.module_from_spec(importlib.machinery.ModuleSpec('GameParams',None))
# 2. Add classes TypeInfo, GPData, GameParams, UIParams to the GameParams module
# The classes are created dynamically using type(), inheriting from nothing (i.e., object automatically) and
# their containing module namespace is set to the GameParams module
setattr(GameParams, 'TypeInfo', type('TypeInfo', (), { '__module__': 'GameParams' }))
setattr(GameParams, 'GPData', type('GPData', (), { '__module__': 'GameParams' }))
setattr(GameParams, 'GameParams', type('GameParams', (), { '__module__': 'GameParams' }))
setattr(GameParams, 'UIParams', type('UIParams', (), { '__module__': 'GameParams' }))
# 3. Inject the module into the loaded modules (otherwise pickling will fail)
sys.modules['GameParams'] = GameParams

# Create a new object of class GameParams
obj = GameParams.GameParams()

# Read the data from the infile
with open(infile, 'r') as f:
    data = json.load(f)

# Assign it to obj
obj.__dict__.update(data)
# Also assign the built-in types and the types from GameParams module to obj
# These are present in the real GameParams.data, and we want to make sure the code under test fails if these are not handled,
# just like in the real thing
for data in [ object, all, any, set, GameParams.GameParams, GameParams.TypeInfo, GameParams.UIParams, GameParams.GPData ]:
    obj.__dict__[data.__name__] = data

# GameParams are an array with two members:
# - first, the actual game params definitions
# - second, a set of what appears to be numeric IDs. Their exact purpose is unknown
gp = [ obj, [] ]
# Write pickle
gp = pickle.dumps(gp, protocol=0) # Apparently Wargaming uses protocol version 0. See below for how to verify this in the future
# Compress with zlib
gp = zlib.compress(gp)
# Reverse 
gp = gp[::-1]

outfile = os.path.join(os.path.dirname(infile), 'GameParams.data')
# Write to outfile
with open(outfile,'wb') as f:
    f.write(gp)

# How to verify protocol version of GameParams.data
# Run the following commands in shell
# python3 -m pickletools GameParams.pickle -o GameParams.dis  # This can take a long, LONG time and generate a very, VERY large disassembly file
# tail GameParams.dis                                         # Will say something like "highest protocol among opcodes = 0"
