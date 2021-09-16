#!/usr/bin/expect -f
set sshUser [lindex $argv 0];
set sshHost [lindex $argv 1];
set sshPass [lindex $argv 2];
set key [lindex $argv 3]

set timeout -1
spawn ssh-copy-id -i "$key" "$sshUser@$sshHost"
expect "$sshUser@$sshHost's password:"
send -- "$sshPass\r"
expect {
	"Permission denied, please try again." {
		send_user "invalid password"
		send -- "$sshPass\r"
        send \x03
        exit 1
    }
}

expect eof