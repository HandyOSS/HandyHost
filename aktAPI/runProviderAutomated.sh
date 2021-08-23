#!/usr/bin/expect -f
set walletKey [lindex $argv 0];
set walletName [lindex $argv 1];
set server [lindex $argv 2];
set cpuPrice [lindex $argv 3];
set txFees [lindex $argv 4];

set timeout -1
spawn ./runProvider.sh $walletName $server $cpuPrice $txFees
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect eof