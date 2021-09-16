#!/bin/bash
docker run --rm \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process config init \
&& \
docker run --rm \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process wireguard config init && \
cd ${HOME}/.sentinelnode && \
openssl ecparam -name prime256v1 -out prime256v1.pem && \
openssl req -new \
-newkey ec:prime256v1.pem \
-x509 \
-sha256 \
-days 365 \
-nodes \
-out tls.crt \
-keyout tls.key \
-subj "/C=/ST=/L=/O=/CN=handyhost"