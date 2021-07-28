#!/bin/bash
docker stop $(docker ps -a -q --filter ancestor=sentinel-dvpn-node --format="{{.ID}}")