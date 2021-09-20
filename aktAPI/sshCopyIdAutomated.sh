#!/usr/bin/expect -f
#nodeUser,node.ip,encPath
log_user 0
set sshUser [lindex $argv 0];
set sshHost [lindex $argv 1];
set encPath [lindex $argv 2];
set key [lindex $argv 3];
set OPENSSL [lindex $argv 4];
set sshPass [exec $OPENSSL rsautl -inkey "$env(HOME)/.HandyHost/keystore/handyhost.key" -decrypt -in $keyEncPath]

exec rm $keyEncPath

set timeout -1
spawn ssh-copy-id -i "$key" "$sshUser@$sshHost"
expect "$sshUser@$sshHost's password:"
send -- "$sshPass\r"
expect {
	"Permission denied, please try again." {
		send_user "invalid password"
		#send -- "invalidpassword\r"
		log_user 1
        send \x03
        
        exit 1
    }
}

expect eof