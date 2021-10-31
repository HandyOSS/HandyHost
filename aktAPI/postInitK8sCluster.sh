#!/bin/bash
#params = ssh_user ssh_server ingress_node_name node_ip
#./postInitK8sCluster.sh ansible akashnode1.local akashnode1 192.168.0.17
#./postInitK8sCluster.sh ansible akash-disastrous-smooth-offer.local akash-disastrous-smooth-offer 192.168.0.220
AKASH_VERSION=$(/bin/bash "$PWD/getAkashLatestVersion.sh")

#first double check we have the ingress crd and other yaml resources from the akash repo
echo "checkout akash repo"
/bin/bash "$PWD/updateAkashRepo.sh"
echo "done checking out akash repo"
#done checking for yamls

echo "INGRESS NODE NAME $3" && \
echo "MASTER IP $4" && \
cd "$HOME/.HandyHost/aktData"
if [[ -s "$HOME/.ssh/known_hosts" ]] ; then
	ssh-keygen -f "${HOME}/.ssh/known_hosts" -R "${4}"
	ssh-keygen -f "${HOME}/.ssh/known_hosts" -R "${2}"
fi

ssh -i "$HOME/.ssh/handyhost" -o StrictHostKeyChecking=accept-new $1@$4 'bash --login echo "" | sudo chown ansible:ansible /etc/kubernetes/admin.conf && exit' && \
scp -i "$HOME/.ssh/handyhost" $1@$4:/etc/kubernetes/admin.conf ./ && \
if [[ "$OSTYPE" == "darwin"* ]]; then
	#nice macOS sed slightly different vs linux
	sed -i'.original' -e 's/127.0.0.1/'"$4"'/g' admin.conf && \
	rm admin.conf.original
else
	sed -i 's/127.0.0.1/'"$4"'/g' admin.conf
fi

##### OG v0.12.2 => v0.14.0
## first we apply the crd for all the things like manifests/etc
export KUBECONFIG=$PWD/admin.conf
mkdir -p ./akash_cluster_resources
cp "${HOME}/.HandyHost/aktData/akashRepo/pkg/apis/akash.network/v1/crd.yaml" ./akash_cluster_resources/crd.yaml && \
kubectl apply -f ./akash_cluster_resources/crd.yaml --overwrite

## new things: we aply the provider crd and new ingress
cd "$HOME/.HandyHost/aktData/akashRepo/script"
kubectl apply -f ../pkg/apis/akash.network/v1/provider_hosts_crd.yaml
kubectl apply -f ../_run/ingress-nginx.yaml
kubectl apply -f ../_run/ingress-nginx-class.yaml

### akash-services name and component=akash-hostname-op might not be needed
kubectl label nodes --all akash.network/role-
kubectl label nodes $3 akash.network/role=ingress --overwrite

#note: networking is required to set akash-services namespace if it didnt already exist..
cd ../_docs
kubectl apply -f ./kustomize/networking;
kubectl kustomize ./kustomize/akash-services/ | kubectl apply -f -

mkdir -p "$HOME/.HandyHost/aktData/akash_cluster_resources" && \
cd "$HOME/.HandyHost/aktData" && \
# copy from repo here since we will modify kustomization.yaml

VERSION_NO_V=$(echo "$AKASH_VERSION" | sed s'/v//g')
cp -r "${HOME}/.HandyHost/aktData/akashRepo/_docs/kustomize/akash-hostname-operator/." ./akash_cluster_resources/akash-hostname-operator && \
echo "images:" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "  - name: ghcr.io/ovrclk/akash:stable" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "    newName: ghcr.io/ovrclk/akash" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "    newTag: $VERSION_NO_V" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
kubectl kustomize ./akash_cluster_resources/akash-hostname-operator/ | kubectl apply -f - ;
