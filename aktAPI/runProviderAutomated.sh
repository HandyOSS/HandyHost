#!/usr/bin/expect -f
#log_user 0
set OPENSSL [lindex $argv 5];

set keyEncPath [lindex $argv 0];
set walletKey [exec $OPENSSL rsautl -inkey "$env(HOME)/.HandyHost/keystore/handyhost.key" -decrypt -in $keyEncPath]
set walletName [lindex $argv 1];
set server [lindex $argv 2];
set cpuPrice [lindex $argv 3];
set txFees [lindex $argv 4];

exec rm $keyEncPath

set timeout -1
spawn ./runProvider.sh "$walletName" $server $cpuPrice $txFees
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "using kube config*"
send_user "\nStarting Akash Provider...\n"
#log_user 1
expect eof