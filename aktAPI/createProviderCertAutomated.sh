#!/usr/bin/expect -f
log_user 0
set keyEncPath [lindex $argv 0];
set walletName [lindex $argv 1];
set server [lindex $argv 2];
set fees [lindex $argv 3];
set OPENSSL [lindex $argv 4];
set walletKey [exec $OPENSSL rsautl -inkey "$env(HOME)/.HandyHost/keystore/handyhost.key" -decrypt -in $keyEncPath]

exec rm $keyEncPath

set timeout -1
spawn ./createProviderCert.sh $walletName $server $fees

expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect "Enter keyring passphrase:"
send -- "$walletKey\r"
expect {
	"confirm transaction before signing and broadcasting*" {
		send -- "y\r";
		send_user "transaction successful:"
	}
	
}
log_user 1
expect eof