#!/bin/bash
cd $HOME/.HandyHost/aktData/kubespray && \
if [[ ! -d $HOME/.HandyHost/aktData/kubespray/inventory/handyhost ]] ; then
	cp -r $HOME/.HandyHost/aktData/kubespray/inventory/sample $HOME/.HandyHost/aktData/kubespray/inventory/handyhost
fi
cp $HOME/.HandyHost/aktData/inventory.yaml $HOME/.HandyHost/aktData/kubespray/inventory/handyhost/myinventory.yaml && \
. venv/bin/activate && \
ansible-playbook -i ./inventory/handyhost/myinventory.yaml -b -v --private-key=$HOME/.ssh/handyhost cluster.yml