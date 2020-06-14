#!/bin/bash

set -e

ganache-cli -a 50 -p 8545 --gasLimit 300000000 --gasPrice 20000000000 -m 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat' 2> /dev/null 1> /dev/null &
sleep 5 # to make sure ganache-cli is up and running before compiling
rm -rf build
truffle compile
truffle migrate --reset --network development
truffle test
kill -9 $(lsof -t -i:8545)