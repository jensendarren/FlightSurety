import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const ORACLES_COUNT = 20;
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;
const STATUS_CODES = [STATUS_CODE_UNKNOWN, STATUS_CODE_ON_TIME, STATUS_CODE_LATE_AIRLINE, STATUS_CODE_LATE_WEATHER, STATUS_CODE_LATE_TECHNICAL, STATUS_CODE_LATE_OTHER];

console.log('The App Contract Address: ', config.appAddress);
console.log('Web3 Version', web3.version);

flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error) console.log(error)
  fetchFlightStatus(event.returnValues);
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

const fetchFlightStatus = async (req) => {
  console.log('Fetching flight status for:', [req.index, req.airline, req.flight, req.timestamp])
  for(let i=0; i<oracles[req.index].length; i++) {
    // pick a status code at random for now!
    let status = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
    console.log("ORACLE USED: ",  oracles[req.index][i]);
    await flightSuretyApp.methods.submitOracleResponse(req.index, req.airline, req.flight, req.timestamp, status).send({from: oracles[req.index][i], gas: 30000000});
  }
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