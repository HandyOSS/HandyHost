#!/bin/bash
if [[ "$OSTYPE" == "darwin"* ]]; then
	###
	# do brew update things here
	###
	echo "Done applying MacOS package updates..."
else
	###
	# do sudo apt install things here
	###
	echo "Done applying Linux package updates..."
fi
exit 0