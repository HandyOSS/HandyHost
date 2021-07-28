HNT packet forwarder shopping list::

- Raspberry pi 4 8GB ($80-90 on eBay/amazon/etc)
- 256GB microSD card ($20-30 best buy etc, also get a microSD reader/writer to plug into your computer to burn the OS image onto the microSD)
- USB-C power adapter for raspberry pi 4 (~$10 on eBay/amazon/etc)
- Lorawan gateway RAK2287 SPI with GPS, include the Raspberry pi hat for $27 https://store.rakwireless.com/collections/wislink-lpwan/products/rak2287-lpwan-gateway-concentrator-module?variant=39661994868934 

Optional: 
- RECOMMENDED: Buy a 5.8dB antenna kit from RAK while you order your lorawan tech to boost your signal and get more coverage/earnings: https://store.rakwireless.com/products/fiber-glass-antenna?variant=39705894813894
- MicroHDMI=>HDMI adapter if you want to hook the pi up to a monitor, else you can setup VNC and be headless (I prefer headless)
- Brass standoffs kit if you want to mount the raspberry pi board to ?? or sit off your literal desktop a bit https://www.amazon.com/GeeekPi-Standoffs-Assortment-Box%EF%BC%8CMale-Female-Screwdriver/dp/B07PHBTTGV/


Docs:
- Building/installation: https://docs.helium.com/use-the-network/build-a-packet-forwarder/
- Light Hotspot roadmap: https://docs.helium.com/mine-hnt/light-hotspots/
- Raspberry Pi Imager (use to burn your OS image onto the raspberry pi sd card): https://www.raspberrypi.org/software/

Tips & Tricks: 
- To add your downloaded 64-bit raspbian OS to the micro sd card (https://downloads.raspberrypi.org/raspios_arm64/images/), open Raspberry Pi Imager, and you can choose the SD card and choose the 64-bit .img you downloaded (.
- Hit ctrl+shift+x while in raspberry pi imager to show advanced options and set your wifi password, hostname, and ssh password for the raspberry pi os. Ssh isn’t enabled by default so this is the easy way to do it headless-ly so you won’t need a monitor.
- Important: After you burn the MicroSD Card image, remove the card then pop it back in. (on Mac host) ```touch /Volumes/boot/ssh```. The act of creating an empty file called ssh on the boot volume enables ssh access to the raspi.
- SSH By IP: Finding the new pi on your network: ```sudo nmap -sP 192.168.0.1/24``` (scan the network before you turn the pi on, and after its active to see the new machines/ips. Alternately by hostname: use the hostname you set in the advanced options like: ```ssh pi@myhostname.local``` (user is always pi) 
- If you’d like more than cli access: Enable vnc on the pi via cli: sudo raspi-config Goto interfacing options, VNC => YES
- Now use VNC-Viewer/etc to connect to your pi heedlessly. 

