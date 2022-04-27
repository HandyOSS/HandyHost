#!/bin/bash
#for post migration of akash cluster to v0.16.1...
#params = ssh_user ssh_server ingress_node_name node_ip
#./postInitK8sCluster.sh ansible akashnode1.local akashnode1 192.168.0.17
#./postInitK8sCluster.sh ansible akash-disastrous-smooth-offer.local akash-disastrous-smooth-offer 192.168.0.220
AKASH_VERSION=$(/bin/bash "$PWD/getAkashLatestVersion.sh")

MASTERNODEUSER=$(cat "$HOME/.HandyHost/aktData/clusterConfig.json" | jq -r '.nodes[] | . as $parent | .kubernetes | select(.isMaster) | $parent.user')
MASTERNODENAME=$(cat "$HOME/.HandyHost/aktData/clusterConfig.json" | jq -r '.nodes[] | . as $parent | .kubernetes | select(.isMaster) | $parent.hostname')
MASTERNODEIP=$(cat "$HOME/.HandyHost/aktData/clusterConfig.json" | jq -r '.nodes[] | . as $parent | .kubernetes | select(.isMaster) | $parent.ip')
INGRESSNAME=$(cat "$HOME/.HandyHost/aktData/clusterConfig.json" | jq -r '.nodes[] | . as $parent | .kubernetes | select(.ingress) | $parent.kubernetes.name')

#echo "AKASH VERSION UPGRADED TO $AKASH_VERSION" && \
echo "INGRESS NODE NAME $INGRESSNAME" && \
echo "MASTER IP $MASTERNODEIP" && \
cd "$HOME/.HandyHost/aktData"

## first we apply the crd for all the things like manifests/etc
#we probably applied it already in the akash provider migrate logic, however when i ran just that alone it didnt quite work, oof.
export KUBECONFIG=$PWD/admin.conf
mkdir -p ./akash_cluster_resources
cp "${HOME}/.HandyHost/aktData/akashRepo/pkg/apis/akash.network/crd.yaml" ./akash_cluster_resources/crd.yaml && \
kubectl apply -f ./akash_cluster_resources/crd.yaml --overwrite

## new things: we aply the provider crd and new ingress
cd "$HOME/.HandyHost/aktData/akashRepo/script"
kubectl apply -f ../_run/ingress-nginx.yaml
kubectl apply -f ../_run/ingress-nginx-class.yaml

### akash-services name and component=akash-hostname-op might not be needed
kubectl label nodes --all akash.network/role-
kubectl label nodes $INGRESSNAME akash.network/role=ingress --overwrite

#note: networking is required to set akash-services namespace if it didnt already exist..
cd ../_docs
kubectl apply -f ./kustomize/networking;
kubectl kustomize ./kustomize/akash-services/ | kubectl apply -f -

mkdir -p "$HOME/.HandyHost/aktData/akash_cluster_resources" && \
cd "$HOME/.HandyHost/aktData" && \
# copy from repo here since we will modify kustomization.yaml

#likely this or networking things above are why the akash provider migrate stuff didnt work out of the box..
VERSION_NO_V=$(echo "$AKASH_VERSION" | sed s'/v//g')
cp -r "${HOME}/.HandyHost/aktData/akashRepo/_docs/kustomize/akash-hostname-operator/." ./akash_cluster_resources/akash-hostname-operator && \
echo "images:" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "  - name: ghcr.io/ovrclk/akash:stable" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "    newName: ghcr.io/ovrclk/akash" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
echo "    newTag: $VERSION_NO_V" >> ./akash_cluster_resources/akash-hostname-operator/kustomization.yaml && \
kubectl kustomize ./akash_cluster_resources/akash-hostname-operator/ | kubectl apply -f - ;
