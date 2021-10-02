#!/bin/bash
VERSIONFILE="$HOME/.HandyHost/aktData/latestAkashVersion"
if [[ ! -s "$VERSIONFILE" ]] ; then
	VERSION=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/ovrclk/akash/releases"))
	echo "$VERSION" > "$VERSIONFILE"
else
	declare -i lastUpdate="$(stat -c %Y $VERSIONFILE)"
	declare -i now="$(date +%s)"
	declare -i diff=$(( $now - $lastUpdate ))
	if (( diff > 1200 )) ; then
		#echo "diff is larger than 20 mins"
		VERSION=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/ovrclk/akash/releases"))
		echo "$VERSION" > "$VERSIONFILE"
	else
		VERSION=$(cat "$VERSIONFILE")
	fi
fi
echo "$VERSION"