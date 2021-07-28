#!/bin/bash
sudo modprobe ip6table_filter && \
(echo $1) | docker run --rm \
--interactive \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
--volume /lib/modules:/lib/modules \
--cap-drop=ALL \
--cap-add=NET_ADMIN \
--cap-add=NET_BIND_SERVICE \
--cap-add=NET_RAW \
--cap-add=SYS_MODULE \
--publish $2:$2/tcp \
--publish $3:$3/udp \
--sysctl net.ipv4.ip_forward=1 \
--sysctl net.ipv6.conf.all.forwarding=1 \
--sysctl net.ipv6.conf.all.disable_ipv6=0 \
--sysctl net.ipv6.conf.default.forwarding=1 \
sentinel-dvpn-node process start