FROM node:16

#installs akash RPC node
#keeps alive with node.js
#in addition, deals with akash falling over at either block 969 or 455200 during initial sync
#HandyHost stands up redis for quick aggregate lookups for provider stats data that won't take > 30s...

WORKDIR /usr/akash

RUN apt-get update
RUN apt install -y zip
RUN apt install -y curl
RUN apt install -y redis
RUN npm install -g project-name-generator
RUN npm install -g forever
RUN npm install redis
RUN npm install @cosmjs/proto-signing
RUN npm install @cosmjs/encoding

ENV AKASH_VERSION="v0.14.1"
ENV AKASH_NET="https://raw.githubusercontent.com/ovrclk/net/master/mainnet"

#RUN curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "v$(curl -s "https://raw.githubusercontent.com/ovrclk/net/master/mainnet/version.txt")"
#manually plug in 0.14.1 for now
RUN curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "${AKASH_VERSION}"

WORKDIR /usr/akash/v0.10.2
#pull 0.10.2 because it's the version that wont fall over on block 969, however falls over at 455200..
RUN curl https://raw.githubusercontent.com/ovrclk/akash/master/godownloader.sh | sh -s -- "v0.10.2"

WORKDIR /usr/akash

ENV PATH="/usr/akash/bin:${PATH}"
RUN bash -l -c 'echo handyhost-$(project-name-generator -w 2 -n -o dashed) >> /usr/akash/moniker'
RUN bash -l -c 'echo export AKASH_MONIKER="$(cat /usr/akash/moniker)" >> /etc/bash.bashrc'

ENV AKASH_CHAIN_ID="akashnet-2"

RUN akash init --chain-id "${AKASH_CHAIN_ID}" "$(cat /usr/akash/moniker)"

RUN curl -s "$AKASH_NET/genesis.json" > "${HOME}/.akash/config/genesis.json"

RUN akash validate-genesis

#set min gas prices for spamminess
RUN sed s"/minimum-gas-prices = \"\"/minimum-gas-prices = \"0.025uakt\"/" -i "${HOME}/.akash/config/app.toml"

#add seed nodes
RUN sed s"/seeds = \"\"/seeds = \"$(curl -s ${AKASH_NET}/seed-nodes.txt | paste -d, -s)\"/" -i  "${HOME}/.akash/config/config.toml"

#change default port just in case we actually run an akash node outside of docker on this box..
RUN sed s"/laddr = \"tcp:\/\/0.0.0.0:26656\"/laddr = \"tcp:\/\/0.0.0.0:26646\"/" -i "${HOME}/.akash/config/config.toml"

#change default port just in case we actually run an akash node outside of docker on this box, also open up to 0.0.0.0
RUN sed s"/laddr = \"tcp:\/\/127.0.0.1:26657\"/laddr = \"tcp:\/\/0.0.0.0:26647\"/" -i "${HOME}/.akash/config/config.toml"

#change default port just in case we actually run an akash node outside of docker on this box..
RUN sed s"/pprof_laddr = \"localhost:6060\"/pprof_laddr = \"localhost:4040\"/" -i "${HOME}/.akash/config/config.toml"

#longer timeout
RUN sed s"/timeout_broadcast_tx_commit = \"10s\"/timeout_broadcast_tx_commit = \"30s\"/" -i "${HOME}/.akash/config/config.toml"

#allow folks to use this rpc server outside this machine
RUN sed s"/cors_allowed_origins = \[\]/cors_allowed_origins = \[\"*\"\]/" -i "${HOME}/.akash/config/config.toml"

#change default port just in case we actually run an akash node outside of docker on this box..
RUN sed s"/proxy_app = \"tcp:\/\/127.0.0.1:26658\"/proxy_app = \"tcp:\/\/127.0.0.1:26648\"/" -i "${HOME}/.akash/config/config.toml"

#change default port just in case we actually run an akash node outside of docker on this box..
RUN sed s"/address = \"0.0.0.0:9090\"/address = \"0.0.0.0:9091\"/" -i "${HOME}/.akash/config/app.toml"

#enable API and gRPC services
RUN sed s"/enable = false/enable = true/" -i "${HOME}/.akash/config/app.toml"

COPY ./keepAkashAlive.js keepAkashAlive.js
COPY ./BlockoRama.js BlockoRama.js
COPY ./redisAggregatesEndpoint.js redisAggregatesEndpoint.js
COPY ./getAggregates.lua getAggregates.lua
COPY ./start.sh start.sh

COPY ./docker-run.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i -e 's/\r$//' /usr/local/bin/docker-entrypoint.sh
RUN chmod 0775 /usr/local/bin/docker-entrypoint.sh

ENV AKASH_NODE="http://localhost:26647"

EXPOSE 26647 26646 26648 4040 9091 26659