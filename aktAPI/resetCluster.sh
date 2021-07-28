#!/usr/bin/expect -f
set timeout -1
spawn ./teardownK8sCluster.sh
expect "Are you sure you want to reset cluster state? Type 'yes' to reset your cluster."
send -- "yes\r"
expect eof