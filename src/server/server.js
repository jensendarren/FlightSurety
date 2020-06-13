import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
console.log(Object.keys(flightSuretyApp));
console.log(flightSuretyApp.abi) // should not be undefined

const ORACLES_COUNT = 20;

console.log('The App Contract Address: ', config.appAddress);
console.log('Web3 Version', web3.version);

flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error) console.log(error)
  console.log(event)
});

const registerOracles =  async () => {
  // TODO; implement code
  return true;
}

// Setup function
(async () => {
  let accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  let registered = await registerOracles();
})();

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;