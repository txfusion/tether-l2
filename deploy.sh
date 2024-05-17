#!/bin/bash

# Load environment variables from the .env file
source .env

# path relative to l1 and l2 folders
ENV_LOCATION="../.env"

set -e

# Specify the JSON file
json_file="addresses.$NODE_ENV.json"

# Check if the JSON file exists
if [ ! -f "$json_file" ]; then
    echo "JSON file does not exist. Creating a new JSON object."
    echo '{}' > "$json_file"
fi

formatAndAppendOrUpdate(){
	line=$(echo "$1" | grep "$2")
	address=$(echo "$line" | awk -F'=' '{print $2}')
	echo "$2=$address"

	# append to .env
	appendOrUpdate "$2" "$address" "$ENV_LOCATION"

    # append to json 	
	# json file in zksync
	json_file_zksync="../$json_file"

	# Read the existing JSON data from the file
	json_data=$(cat "$json_file_zksync")

	# Use jq to add/update the custom key and value
	updated_json=$(echo "$json_data" | jq ". + {\"$2\": \"$address\"}")

	# Save the updated JSON back to the file
	echo "$updated_json" > "$json_file_zksync"
}

appendOrUpdate(){
	# Check if the line exists in .env
	if grep -q "$1=" "$3"; then
		# Update the line in .env
		if [[ "$OSTYPE" == "darwin"* ]]; then
			# sed -i is case insensitive in OSX thats why single quotes are added
			sed -i '' "s|^$1=.*$|$1=$2|" "$3"
		else
			sed -i "s|^$1=.*$|$1=$2|" "$3"
		fi
	else
		# Append the line to .env
		echo "$1=$address" >> "$3"
	fi
}


cd ./l1

echo "DEPLOYING L1 BRIDGE"
echo "======================="

# DEPLOY L1 BRIDGE
output=$(npm run deploy-bridges)


## CONTRACTS_L1_TOKEN_ADDR
if [ "$NODE_ENV" = "local" ]; then
	formatAndAppendOrUpdate "$output" "CONTRACTS_L1_TOKEN_ADDR"
else
    echo 'Skipping L1 ERC20 Token deployment. Token already exists.'
fi

## CONTRACTS_L1_BRIDGE_PROXY_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_BRIDGE_PROXY_ADDR"

cd ../l2

echo "==============================="
echo "DEPLOYING USDT TOKEN"

output=$(npm run deploy-usdt-token)
# formatAndAppendOrUpdate "$output" "CONTRACTS_L2_TOKEN_IMPLEMENTATION_ADDR"
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_TOKEN_PROXY_ADDR"

cd ../l1

echo "==============================="
echo "INITIALIZING BRIDGES"

output=$(npm run initialize-bridges)
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_BRIDGE_PROXY_ADDR"

cd ../l2

echo "==============================="
echo "CONNECTING L2 BRIDGE TO L2 TOKEN"

npm run connect-token-to-bridge

cd ../l1

echo "==============================="
echo "INITIALIZING BRIDGE ROLES"

npm run init-bridge-roles
