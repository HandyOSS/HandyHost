#!/bin/bash
ssh-keygen -f "${HOME}/.ssh/known_hosts" -R "${1}"