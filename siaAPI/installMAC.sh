#!/bin/bash
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

architecture=$(uname -m)
arch_name="amd64"
if [ "${architecture}" = "arm64" ]; then
    arch_name="arm64"
fi

which -s go
if [[ $? != 0 ]] ; then
	echo "installing golang"
	wget "https://golang.org/dl/go1.17.darwin-${arch_name}.pkg" && \
	sudo rm -rf /usr/local/go && \
	sudo tar -C /usr/local -xzf "go1.17.darwin-${arch_name}.pkg"
fi

export PATH=$PATH:/usr/local/go/bin && \

if [[ ! -s "$HOME/.HandyHost/siaRepo" ]] ; then

	mkdir -p $HOME/.HandyHost/siaRepo && \
	git clone https://github.com/SiaFoundation/siad $HOME/.HandyHost/siaRepo 
else
	cd $HOME/.HandyHost/siaRepo && \
	git fetch --all && \
	git pull
fi

cd $HOME/.HandyHost/siaRepo && make dependencies && make && \
if ! grep -q 'usr/local/go/bin' "${profile_file}" ; then
  echo "###Editing ${profile_file} to add go env variables###"
  echo "export PATH=$PATH:/usr/local/go/bin:${HOME}/go/bin" >> "${profile_file}"
  source $profile_file
fi

exit 0
