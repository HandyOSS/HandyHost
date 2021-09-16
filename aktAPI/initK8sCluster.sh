#!/bin/bash
cd $HOME/.HandyHost/aktData/kubespray && \
if [[ ! -d ./inventory/handyhost ]] ; then
	cp -r ./inventory/sample ./inventory/handyhost
fi
cp $HOME/.HandyHost/aktData/inventory.yaml ./inventory/handyhost/myinventory.yaml && \
. venv/bin/activate && \
ansible-playbook -i ./inventory/handyhost/myinventory.yaml -b -v --private-key=$HOME/.ssh/handyhost cluster.yml