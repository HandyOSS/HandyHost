#!/bin/bash
VERSIONFILE="$HOME/.HandyHost/aktData/latestKubesprayVersion"
if [[ ! -s "$VERSIONFILE" ]] ; then
	VERSION=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/kubernetes-sigs/kubespray/releases"))
	echo "$VERSION" > "$VERSIONFILE"
else
	if [[ "$OSTYPE" == "darwin"* ]] ; then
		declare -i lastUpdate="$(stat -f %m -t %Y $VERSIONFILE)"
	else
		declare -i lastUpdate="$(stat -c %Y $VERSIONFILE)"
	fi
	declare -i now="$(date +%s)"
	declare -i diff=$(( $now - $lastUpdate ))
	if (( diff > 1200 )) ; then
		#echo "diff is larger than 20 mins"
		VERSION=$(jq -r 'map(select(.prerelease != true)) | first | .tag_name' <<< $(curl --silent "https://api.github.com/repos/kubernetes-sigs/kubespray/releases"))
		echo "$VERSION" > "$VERSIONFILE"
	else
		VERSION=$(cat "$VERSIONFILE")
	fi
fi

LATEST_KUBESPRAY="$VERSION"
LOCAL_KUBESPRAY=$(cd "$HOME/.HandyHost/aktData/kubespray" && git describe --tags )
echo "{\"latest\":\"$LATEST_KUBESPRAY\",\"local\":\"$LOCAL_KUBESPRAY\"}"