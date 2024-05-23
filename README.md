# BTC rate logger

## Deployment

Create namespace and install prerequisites:

```
kubectl create namespace btc

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx

kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v1.8.0/cert-manager.crds.yaml
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace
```

Copy default values (edit secrets as needed):

```
cp deploy/values.yaml.example deploy/values.yml
```

Deploy the application stack:

```
helm install btcrate ./deploy --namespace btc
```

## Get the auth token

```
curl -k -X POST https://btcrate.myorg.com/login
```

## Check latest data

```
curl -k -H "Authorization: <token>" https://btcrate.myorg.com/last | jq
```

## Force current rate retrieval

```
curl -k -H "Authorization: <token>" https://btcrate.myorg.com/retrieve
```

## Local deployment with docker-compose

1. Copy `.env.example` to `.env` and edit as needed
2. `docker-compose up -d --build`
