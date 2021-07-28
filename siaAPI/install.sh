#!/bin/bash
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi

architecture=$(dpkg --print-architecture)

wget "https://golang.org/dl/go1.16.6.linux-${architecture}.tar.gz" && \
sudo rm -rf /usr/local/go && \
sudo tar -C /usr/local -xzf "go1.16.6.linux-${architecture}.tar.gz" && \
export PATH=$PATH:/usr/local/go/bin && \
mkdir -p $HOME/.HandyHost/siaRepo && \
git clone https://github.com/SiaFoundation/siad $HOME/.HandyHost/siaRepo && \
cd $HOME/.HandyHost/siaRepo && make dependencies && make && \
if ! grep -q 'usr/local/go/bin' "${profile_file}" ; then
  echo "Editing ${profile_file} to add go env variables"
  echo "export PATH=$PATH:/usr/local/go/bin" >> "${profile_file}"
fi