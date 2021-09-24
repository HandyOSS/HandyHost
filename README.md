## HandyHost

HandyHost is a modern cryptocurrency "mining" software which allows you to monetize off-the-shelf hardware for passive income all while providing real utility to users versus just minting monies. Currently there are 3 main distributed-web utility blockchains that we implement within HandyHost. 
1. DVPN - DVPN (as the name suggests) is decentralized VPN. You rent your extra bandwidth for $DVPN. In addition, the DVPN service allows resolution of Handshake (HNS) Top-Level-Domains, allowing your users to resolve the future.
2. AKT - Akash is a decentralized server rental marketplace. Akash allows you to setup clusters of servers and rent them out, becoming a mini Amazon EC2.
3. Sia - SiaCoin (SC) is a long established provider of distributed disk space. As a Sia Host, you rent out disk space and bandwidth for passive income.

More of our tutorials and explainers about each service can be found on our [YouTube Channel](https://www.youtube.com/channel/UCo9mpJA4MHAf_iZYHDieADQ)

### Installation (Ubuntu Desktop 64-bit)
There is a compiled .deb package that can be found in Releases. There are many apt dependencies and thus you will have to install thru dpkg and apt like:
```sudo dpkg -i handyhost_vX.X.X.deb || sudo apt install -f```
On subsequent debian installs you can likely just double click the .deb file (assuming no new apt dependencies). 
The Debian package will install HandyHost as a daemon which can be spawned/unspawned like:
```sudo systemctl restart handyhost``` (stop | start | restart)
and the daemon will start on machine startup. 
Application logs can be found in /var/log/handyhost.log

### Installation (MacOS)
Prerequisites: 
1. some xcode command line tools are required during building of dependencies. You must run ```sudo xcode-select --install``` on your terminal before running the installer. 
2. The various projects depend on standard packages installed from [homebrew](https://brew.sh/). 
You can run this command to install Homebrew on your system:
```/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
3. Docker. DVPN runs its service in containers, thus you need Docker. Now that we have homebrew it is easy to install. Just run: ```brew install --cask docker```. Once installed, open the Docker.app (in /Applications), accept the EULA, and then you can close the Docker application and continue the install.

After installing prerequisites, the double click package installer can be found in Releases, and will take ~20-30 minutes to download/compile all dependencies.


To tail the installer progress logs, you can run ```tail -f /var/log/install.log``` in your terminal.

Once the installer is finished you can run the app by double clicking the HandyHost.app in /Applications/Handyhost
The app will keep a daemon running in the background that if you wish to kill manually, there is a command to kill it listed in the HandyHost.app screen.
If you wish to start the app on startup, add it to your startup items.

### Build/Run from source (MacOS)
Should you not want to run the package installer, you can manually do the install process. 

**Prerequisites**: 
1. some xcode command line tools are required during building of dependencies. You must run ```sudo xcode-select --install``` on your terminal before running the installer. 
2. The various projects depend on standard packages installed from [homebrew](https://brew.sh/). 
You can run this command to install Homebrew on your system:
```/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"```
3. Docker. DVPN runs its service in containers, thus you need Docker. Now that we have homebrew it is easy to install. Just run: ```brew install --cask docker```. Once installed, open the Docker.app (in /Applications), accept the EULA, and then you can close the Docker application and continue the install.

**Installation**:
1. ```sudo ./installMAC_PKG_POSTINSTALL.sh local``` is the same installer that the package uses internally. It will install (if they dont already exist) homebrew, a ton of dependencies, go, Sia, DVPN, Akash, etc. 

2. ```npm start``` to run the service.

### Build/Run from source (Ubuntu)
1. Install some apt repos for dependencies (```./debian_package_utils/preinst``` or ):
```
wget -qO /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg && \
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
wget -qO- https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && \
sudo apt update
```
2. Install dependencies:
```
sudo apt install -y git curl build-essential curl openssl uidmap unzip libssl-dev avahi-utils virtualenv expect kubectl p7zip-full genisoimage whois nmap docker-ce docker-ce-cli containerd.io systemd-container apt-transport-https ca-certificates gnupg lsb-release
```
3. Run the installer:
```./installUbuntu.sh```
4. Start with:
```./localdev_bootstrap.sh``` optionally restart with ```./localdev_bootstrap.sh restart```
5. application logs can be found in: ```~/.HandyHost/localdev.log```

### Rig Builds:

[HandyHost MasterNode Build Spreadsheet (20TB storage, hosts DVPN/SIA and manages your AKT Cluster)](https://docs.google.com/spreadsheets/d/1IzIiKbsBy_IblG-K99nxzjlg70b4_Yaxh5TJCbWzvjA/edit?usp=sharing)

[HandyHost Akash Node Components Spreadsheet](https://docs.google.com/spreadsheets/d/1-WJb0tL7v__S62BDUu457A4yz9Y6U-nie95a_zF58kU/edit?usp=sharing)

[A YouTube tutorial on building an akash cluster](https://youtu.be/Jqg3z3PMOwI)

### A few notes about monies

**What HandyHost is NOT**: A long term storage wallet for your life savings or big monies. Although each service requires you have wallets attached to them, the wallets/funds are mainly there to pay transaction fees, place deposits/collateral, and of course receive your passive income payments. Once you have accrued enough extra money in your wallet, please move it to a more permanent storage medium (and probably stake it via Cosmostation/Keplr/Osmosis in the case of DVPN and AKT). 
Although we lock everything down as well as we can, you ultimately have wallets running attached to 1. your local network and any machines on said network, 2. you have open ports to the whole world for the various services you will host, 3. you are hosting servers and your bandwidth to the outside world. 
Althought we go farther than most Sia services recommendations by encrypting any wallet informations at rest, we still think anything is possible and that you should be safe (ie: dont hold your life savings wallet into this mining service wallet). 
Why all the tldr;? To host some of these services (Sia, for instance), your wallet needs to be unlocked at all times to pay collateral deposits and fees. Traditionally Sia recommends to pass wallet unlock keys to the application by environment variables and store the keys safely on disk at rest. You don't want to miss out on income because your computer restarted overnight... 
We go an extra step further than the recommendations and encrypt the unlock keys at rest, and only provide an encrypted key location to the HandyHost application on startup. After the application has decrypted and used the passwords, the temporary encrypted key file is deleted.
I'm still not crazy about the idea but it's about as good as it gets for running a daemon that needs to auto-startup without you sitting at the keyboard.


### Testing/Private development things
To test the in-app updates while the repo is still private, we need to set our github access token to an environment variable in our .profile. Depending on which user you run the app as (default = root), you will want to dump this line into the .profile of the appropriate runner of the HandyHost Daemon.

```sudo echo "export HANDYHOST_PRIVATE_REPO_TOKEN=ghp_jQX....2gP" >> /root/.profile```

And if the daemon is already running, you will want to ```sudo systemctl restart handyhost``` to reload your token.

Upon doing so, you will see a link in the left-hand options menu in the app to update HandyHost from within the app.

Below are instructions on how to get your github access token.

### To use in-app updater:
1. since the repo is still private we need a github personal access token. In github, go to the very top right of the screen to show your options. Then goto Settings. Scroll down the left options and click "Developer Settings", then in the subsequent left menu click "Personal Access Tokens" and then click the button for "Generate New Token". Then use settings: "90 days", Select top level scope for "Repo" which should check all the repo boxes under it. Then "Generate Token". Now copy the token from the following screen, should look like ```ghp_123456abcd.....efef123``` and plug that into the command line like::
```sudo echo "export HANDYHOST_PRIVATE_REPO_TOKEN=ghp_jQX....2gP" >> /root/.profile```
