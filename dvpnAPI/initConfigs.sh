#!/bin/bash
docker run --rm \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process config init \
&& \
docker run --rm \
--volume ${HOME}/.sentinelnode:/root/.sentinelnode \
sentinel-dvpn-node process wireguard config init && \
cd ${HOME}/.sentinelnode && \
(echo ""; echo""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "") \
| openssl req -new \
-newkey ec \
-pkeyopt ec_paramgen_curve:prime256v1 \
-x509 \
-sha256 \
-days 365 \
-nodes \
-out tls.crt \
-keyout tls.key
