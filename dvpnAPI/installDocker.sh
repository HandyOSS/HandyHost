#!/bin/bash
#must be run as sudo
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
sudo apt-get update && \
sudo apt-get install --yes curl && \
sudo apt-get install --yes openssl && \
curl -fsSL get.docker.com -o ${HOME}/get-docker.sh && \
sudo sh ${HOME}/get-docker.sh && \
echo "groupadd docker" && \
sudo groupadd docker || true && \
sudo gpasswd -a $USER docker || true && \
echo "setting up nosudo docker" && \
#sudo sh -eux <<EOF
# Install newuidmap & newgidmap binaries
sudo apt-get install -y uidmap && \
#EOF ) && \
dockerd-rootless-setuptool.sh install && \
if ! grep -q 'DOCKER_HOST' "${profile_file}" ; then
  echo "export PATH=/usr/bin:$PATH" >> "${profile_file}"
  echo "export DOCKER_HOST=unix:///run/user/1000/docker.sock" >> "${profile_file}"
  source $profile_file
fi
