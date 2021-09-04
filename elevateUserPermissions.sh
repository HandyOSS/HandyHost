#!/bin/bash
USERNAME="$SUDO_USER"
cat >> /etc/sudoers << EOF
$USERNAME ALL=(ALL) NOPASSWD:ALL
EOF