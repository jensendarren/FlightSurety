import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const ORACLES_COUNT = 20;

console.log('The App Contract Address: ', config.appAddress);
console.log('Web3 Version', web3.version);

flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error) console.log(error)
  console.log(event)
});

let accounts;
let oracles = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
  9: [],
};

const registerOracles =  async () => {
  let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();

  for(let i=1; i<ORACLES_COUNT; i++) {
    await flightSuretyApp.methods.registerOracle().send({ from: accounts[i], value: fee, gas: 30000000 });
    let result = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]});
    oracles[result[0]].push(accounts[i]);
    oracles[result[1]].push(accounts[i]);
    oracles[result[2]].push(accounts[i]);
  }

  console.log('ORACLES SAVED: ------', oracles);

  return true;
}

// Setup function
(async () => {
  accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  console.log("DEFAULT ACCOUNT", web3.eth.defaultAccount);
  let registered = await registerOracles();
})();

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;