#!/usr/bin/expect -f
#nodeUser,node.ip,encPath
log_user 0
set sshUser [lindex $argv 0];
set sshHost [lindex $argv 1];
set keyEncPath [lindex $argv 2];
set key [lindex $argv 3];
set OPENSSL [lindex $argv 4];
set sshPass [exec $OPENSSL rsautl -inkey "$env(HOME)/.HandyHost/keystore/handyhost.key" -decrypt -in $keyEncPath]

exec rm $keyEncPath
set timeout -1
spawn ssh-copy-id -i "$key" "$sshUser@$sshHost" -f
expect "*sure you want to continue connecting*"
	send -- "yes\r"

expect {
	"*$sshUser@$sshHost's password*" {
		log_user 0
		send -- "$sshPass\r"
		log_user 0
		exp_continue
	}
	"Permission denied, please try again." {
		
		send_user "invalid password"
		log_user 1
		#send -- "invalidpassword\r"
		#log_user 1
        send \x03
        
        
    }
}

#expect eof