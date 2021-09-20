#!/bin/bash
#params = ssh_user ssh_server ingress_node_name node_ip
#./postInitK8sCluster.sh ansible akashnode1.local akashnode1 192.168.0.17
echo "INGRESS NODE NAME $3" && \
echo "MASTER IP $4" && \
cd "$HOME/.HandyHost/aktData" && \
ssh-keygen -f "${HOME}/.ssh/known_hosts" -R "${2}" && \
ssh -i "$HOME/.ssh/handyhost" $1@$2 'bash --login echo "" | sudo chown ansible:ansible /etc/kubernetes/admin.conf && exit' && \
#ssh -oStrictHostKeyChecking=accept-new -i "$HOME/.ssh/handyhost" $1@$2 'bash --login echo "" | sudo chown ansible:ansible /etc/kubernetes/admin.conf && exit' && \
scp -i "$HOME/.ssh/handyhost" $1@$2:/etc/kubernetes/admin.conf ./ && \
if [[ "$OSTYPE" == "darwin"* ]]; then
	#nice macOS sed slightly different vs linux
	sed -i'.original' -e 's/127.0.0.1/'"$4"'/g' admin.conf && \
	rm admin.conf.original
else
	sed -i 's/127.0.0.1/'"$4"'/g' admin.conf
fi
export KUBECONFIG=$PWD/admin.conf && \
mkdir -p ./akash_cluster_resources && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/pkg/apis/akash.network/v1/crd.yaml --output akash_cluster_resources/crd.yaml && \
kubectl apply -f ./akash_cluster_resources/crd.yaml --overwrite && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/_docs/kustomize/networking/network-policy-default-ns-deny.yaml --output akash_cluster_resources/network-policy-default-ns-deny.yaml && \
kubectl apply -f ./akash_cluster_resources/network-policy-default-ns-deny.yaml --overwrite && \
curl https://raw.githubusercontent.com/ovrclk/akash/master/_run/ingress-nginx.yaml --output ./akash_cluster_resources/ingress-nginx.yaml && \
kubectl apply -f ./akash_cluster_resources/ingress-nginx.yaml --overwrite && \
kubectl delete -A ValidatingWebhookConfiguration ingress-nginx-admission && \
kubectl label nodes --all akash.network/role- && \
kubectl label nodes $3 akash.network/role=ingress --overwrite



