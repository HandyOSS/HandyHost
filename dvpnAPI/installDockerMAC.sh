#!/bin/bash
#must be run as sudo
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

#brew cask install docker
which -s docker
if [[ $? != 0 ]] ; then
	echo "Installing Docker..."
	brew cask install docker
else
	echo "Docker Already Installed. Skipping."
	echo "Starting Docker, this may take a minute..."
	open --background -a Docker &&
  	while ! docker system info > /dev/null 2>&1; do sleep 1; done
fi
exit 0

# curl -fsSL get.docker.com -o ${HOME}/get-docker.sh && \
# sudo sh ${HOME}/get-docker.sh && \
# echo "groupadd docker" && \
# sudo groupadd docker || true && \
# sudo gpasswd -a $USER docker || true && \
# echo "setting up nosudo docker" && \
# #sudo sh -eux <<EOF
# # Install newuidmap & newgidmap binaries
# sudo apt-get install -y uidmap && \
# #EOF ) && \
# dockerd-rootless-setuptool.sh install && \
# if ! grep -q 'DOCKER_HOST' "${profile_file}" ; then
#   echo "export PATH=/usr/bin:$PATH" >> "${profile_file}"
#   echo "export DOCKER_HOST=unix:///run/user/1000/docker.sock" >> "${profile_file}"
#   source $profile_file
# fi
# export PATH=/usr/bin:$PATH
# export DOCKER_HOST=unix:///run/user/1000/docker.sock
