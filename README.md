## HandyHost

**HandyHost is currently in a Beta release state as of 10/05/2021, version 0.4.5**

HandyHost is a modern cryptocurrency "mining" software which allows you to monetize off-the-shelf hardware for passive income all while providing real utility to users versus just minting monies. Currently there are 3 main distributed-web utility blockchains that we implement within HandyHost. 
1. DVPN - [Sentinel](https://sentinel.co/dvpn) ($DVPN) (as the name suggests) is decentralized VPN. You rent your extra bandwidth for $DVPN. In addition, the DVPN service allows resolution of Handshake (HNS) Top-Level-Domains, allowing your users to resolve the future.
2. AKT - [Akash](https://akash.network/) ($AKT) is a decentralized server rental marketplace. Akash allows you to setup clusters of servers and rent them out, becoming a mini Amazon EC2.
3. Sia - [SiaCoin](https://sia.tech/) ($SC) is a long established provider of distributed disk space. As a Sia Host, you rent out disk space and bandwidth for passive income.

More of our tutorials and explainers about each service can be found on our [YouTube Channel](https://www.youtube.com/channel/UCo9mpJA4MHAf_iZYHDieADQ)

### Supported Platforms
Currently we have built HandyHost for Debian/Ubuntu (64-bit) and MacOS. We will have Windows support in the future.

Ubuntu Recommended Versions: We have tested extensively with Ubuntu 20.04 and 21.04 **64-bit only**. 

### Requirements

1. You need to have some familiarity with home networking/port forwarding. You will need to setup a fair amount of port forwarding for each platform.
2. General IT knowledge and terminology.
3. Familiar enough with a command line to know how to move around (example) ```cd ~/Downloads``` and run simple commands.
4. Hardware. [View our list of build examples](#hardware) discussed in detail in our [Video Tutorials](#videos)
5. A decent internet connection (recommended minimum 10MB upload / 100MB download)
6. Network uptime. For any of these services you should have a hardwired ethernet connection to any devices that is always (within reason) up and on.
7. You should have familiarity with crypto wallets, mainly: keeping your keys safe somewhere non-electronic and how to buy crypto ($SC, $AKT, $DVPN). $SC is easy to buy/hold on Kraken. $AKT and $DVPN can easily be swapped for $ATOM (also available on Kraken) on [osmosis.zone](https://osmosis.zone) via [keplr wallet](https://wallet.keplr.app/).
8. (things you should aspire to do) Staking. $AKT and $DVPN can be staked for very high APY% within either [keplr wallet](https://wallet.keplr.app/) for desktop and/or [Cosmostation](https://wallet.cosmostation.io/) for mobile. In addition you can look into Liquidity Pool Mining through [osmosis.zone](https://osmosis.zone) for a very high APY%.

### Installation (Ubuntu Desktop 64-bit)
There is a compiled .deb package that can be found in Releases. There are many apt dependencies and thus you will have to download it and install thru dpkg and apt like:
```sudo dpkg -i handyhost_vX.X.X.deb || sudo apt install -f -y```
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

After installing prerequisites, the double click package installer can be found in [Releases](https://github.com/HandyOSS/HandyHost/releases) and will take ~20-30 minutes to download and compile all dependencies.


To tail the installer progress logs, you can run ```tail -f /var/log/install.log``` in your terminal.

Once the installer is finished you can run the app control panel by double clicking the HandyHost.app in /Applications/Handyhost. You should notice a status bar icon for handyhost show up in the top right of your MacOS toolbar. 
In addition, the HandyHost Daemon will automatically startup when you login to the machine.

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

2. ```./runMAC_APP.sh startup``` to start the daemon. Logs are output to ```~/.HandyHost/handyhost.log```. You can kill the daemon with ```./runMAC_APP.sh stop``` or restart the daemon with ```./runMAC_APP.sh restart```

### Build/Run from source (Ubuntu)
1. Install some apt repos for dependencies:
```
wget -qO /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg && \
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
wget -qO- https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && \
sudo apt update
```
2. Install dependencies:
```
sudo apt install -y git curl jq build-essential curl openssl uidmap unzip libssl-dev avahi-utils virtualenv expect kubectl p7zip-full genisoimage whois nmap docker-ce docker-ce-cli containerd.io systemd-container apt-transport-https ca-certificates gnupg lsb-release net-tools
```
3. Run the installer:
```./installUbuntu.sh``` note: you may or may not want to change line 4 or 5 depending if you want the app/blockchain datas installed to /root or your user $HOME.
4. Start the daemon with:
```./localdev_bootstrap.sh``` optionally restart with ```./localdev_bootstrap.sh restart```, and stop with ```localdev_bootstrap.sh stop```. note: you may or may not want to change line 5 and 6 depending if you want the app/blockchain datas installed to /root or your user $HOME.
5. application logs can be found in: ```~/.HandyHost/localdev.log```

<a id="videos"></a>
### Video Tutorials

[Sia Host Setup Video Tutorial](https://youtu.be/9x3CS6cd3jg)
[DVPN Host Setup](https://youtu.be/5GxRoVDOFKE)
[Akash Part 1, Hardware Setup](https://youtu.be/Jqg3z3PMOwI)
[Akash Part 2, Software Setup](https://youtu.be/QV6qhjyQ6dc)

<a id="harddware"></a>
### Rig Hardware Builds:

[HandyHost MasterNode Build Spreadsheet (20TB storage, hosts DVPN/SIA and manages your AKT Cluster)](https://docs.google.com/spreadsheets/d/1IzIiKbsBy_IblG-K99nxzjlg70b4_Yaxh5TJCbWzvjA/edit?usp=sharing)

[HandyHost Akash Node Components Spreadsheet](https://docs.google.com/spreadsheets/d/1-WJb0tL7v__S62BDUu457A4yz9Y6U-nie95a_zF58kU/edit?usp=sharing)

[HandyHost DVPN Raspberry Pi 4 Components Spreadsheet](https://docs.google.com/spreadsheets/d/1njYVqVFq7KoyKZ2XzWPTzy1W6zlTz84egL_EtIrTsqc/edit?usp=sharing)

### A few notes about monies

**What HandyHost is NOT**: A long term storage wallet for your life savings or big monies. Although each service requires you have wallets attached to them, the wallets/funds are mainly there to pay transaction fees, place deposits/collateral, and of course receive your passive income payments. Once you have accrued enough extra money in your wallet, please move it to a more permanent storage medium (and probably stake it via Cosmostation/Keplr/Osmosis in the case of DVPN and AKT). 
Although we lock everything down as well as we can, you ultimately have wallets running attached to 1. your local network and any machines on said network, 2. you have open ports to the whole world for the various services you will host, 3. you are hosting servers and your bandwidth to the outside world. 
Althought we go farther than most Sia services recommendations by encrypting any wallet informations at rest, we still think anything is possible and that you should be safe (ie: dont hold your life savings wallet into this mining service wallet). 
Why all the tldr;? To host some of these services (Sia, for instance), your wallet needs to be unlocked at all times to pay collateral deposits and fees. Traditionally Sia recommends to pass wallet unlock keys to the application by environment variables and store the keys safely on disk at rest. You don't want to miss out on income because your computer restarted overnight... 
We go an extra step further than the recommendations and encrypt the unlock keys at rest, and only provide an encrypted key location to the HandyHost application on startup. After the application has decrypted and used the passwords, the temporary encrypted key file is deleted.
I'm still not crazy about the idea but it's about as good as it gets for running a daemon that needs to auto-startup without you sitting at the keyboard.

##### [LICENSE](https://github.com/HandyOSS/HandyHost/blob/master/LICENSE) 

Copyright (C) 2021  
- Alex Smith - alex.smith@earthlab.tech
- Steven McKie - mckie@amentum.org
- Thomas Costanzo - stanzo89@gmail.com

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.
This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA