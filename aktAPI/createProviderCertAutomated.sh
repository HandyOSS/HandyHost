#!/usr/bin/expect -f
set walletKey [lindex $argv 0];
set walletName [lindex $argv 1];
set server [lindex $argv 2];

set timeout -1
spawn ./createProviderCert.sh $walletName $server
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "confirm transaction before signing and broadcasting*"
send -- "y\r"
expect eof