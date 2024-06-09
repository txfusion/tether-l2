#!/bin/bash

echo "+---------------------------------+"
echo "|                                 |"
echo "|    Compiling L1 contracts...    |"
echo "|                                 |"
echo "+---------------------------------+"

cd ./l1 && npm run compile

printf "\n\n"

echo "+---------------------------------+"
echo "|                                 |"
echo "|    Compiling L2 contracts...    |"
echo "|                                 |"
echo "+---------------------------------+"

cd ../l2 && npm run compile
