#!/bin/bash
cd ${HOME}/.HandyHost/sentinelData/dvpn-node && \
git fetch --all --quiet && \
#get all tags sorted by date asc
ALLTAGS=$(git for-each-ref --sort=creatordate --format '%(refname)' refs/tags)
#replace refs/tags/
ALLTAGS=${ALLTAGS//refs\/tags\//}
#get current tag
CURRENTTAG=$(git describe --tags)
#all tags to array
ALLTAGSARR=($ALLTAGS)

OUTPUT=""
#last item pos
POS=$(( ${#ALLTAGSARR[*]} - 1 ))
LAST=${ALLTAGSARR[$POS]}
FIRST=${ALLTAGSARR[0]}

for tag in $ALLTAGS
do
  if [ "$tag" = "$LAST" ]
  then
   DELIM=""
  else
   DELIM=","
  fi

  if [ "$tag" = "$FIRST" ]
  then
   OUTPUT="\"${tag}\"${DELIM}"
  else
    OUTPUT="${OUTPUT}\"${tag}\"${DELIM}"
  fi

done
#output json
echo "{\"current\":\"${CURRENTTAG}\",\"all\":[$OUTPUT]}"
