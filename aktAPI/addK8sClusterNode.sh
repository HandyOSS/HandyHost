#!/bin/bash
cd "$HOME/.HandyHost/aktData/kubespray" && \
. venv/bin/activate && \
ansible-playbook -i ./inventory/handyhost/myinventory.yaml -b -v --private-key="$HOME/.ssh/handyhost" facts.yml &&
ansible-playbook -i ./inventory/handyhost/myinventory.yaml -b -v --private-key="$HOME/.ssh/handyhost" scale.yml --limit="$1"