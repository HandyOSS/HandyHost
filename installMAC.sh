#!/bin/bash
#mac installer
if [[ ! -s "$HOME/.bash_profile" && -s "$HOME/.profile" ]] ; then
  profile_file="$HOME/.profile"
else
  profile_file="$HOME/.bash_profile"
fi
if [[ -s "$HOME/.zshrc" ]] ; then
	profile_file="$HOME/.zshrc"
fi

pwd=${PWD}
echo "########## Installing HandyHost Dependencies... ##########"
which -s brew
if [[ $? != 0 ]] ; then
    # Install Homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if ! grep -q 'usr/local/bin' "${profile_file}" ; then
	  echo "###Editing ${profile_file} to add /usr/local/bin variables###"
	  echo "export PATH=$PATH:/usr/local/bin" >> "${profile_file}"
	  source $profile_file
	fi
else
	echo "Homebrew Already Installed. Skipping Install."
	echo "Updating Homebrew..."
	brew update
fi

which -s node
if [[ $? != 0 ]] ; then
	echo "needs node"
	brew install node
else
	echo "nodejs Installed. Skipping."
fi

npm install --build-from-source --python=/usr/bin/python3 && \
sudo npm install -g bower && \
cd $pwd/client && \
bower install && \
mkdir -p $HOME/.HandyHost && \
echo "########## Installing Sia ##########" && \
cd $pwd/siaAPI && ./installMAC.sh && \
echo "########## Installing DVPN ##########" && \
cd $pwd/dvpnAPI && ./installDockerMAC.sh && ./installDVPNMAC.sh && \
echo "########## Installing Akash ##########" && \
cd $pwd/aktAPI && ./installDependenciesMAC.sh && ./installMAC.sh && \
echo "########## DONE INSTALLING! ##########" && \
node $pwd/rainbow.js && \
exit 0
#sudo apt-get install -y build-essential && \


