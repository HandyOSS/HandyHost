#!/bin/bash
cd ~/.HandyHost/aktData/kubespray && \
cp ~/.HandyHost/aktData/inventory.yaml inventory/handyhost/myinventory.yaml && \
. venv/bin/activate && \
ansible-playbook -i inventory/handyhost/myinventory.yaml -b -v --private-key=~/.ssh/handyhost cluster.yml