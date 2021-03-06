import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let registeredAirline;

const ORACLES_COUNT = 20;
const ORACLE_ACCOUNT_START_INDEX = 30; // make sure to start ganache cli with at least 50 accounts
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
let flights = [
  ['AC110', '1591878209161'],
  ['BA220', '1592117654886'],
  ['PP999', '1591877624540'],
  ['AC7559', '1511875664760'],
  ['TG910', '1591877664560'],
  ['AF888', '1595877664555'],
  ['BA09', '1591877664510'],
  ['VA777', '1591877664000'],
  ['TG920', '1591877661111']
]
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
  let accountIndex = ORACLE_ACCOUNT_START_INDEX;

  for(let i=1; i<ORACLES_COUNT; i++) {
    await flightSuretyApp.methods.registerOracle().send({ from: accounts[accountIndex], value: fee, gas: 30000000 });
    let result = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[accountIndex]});
    oracles[result[0]].push(accounts[accountIndex]);
    oracles[result[1]].push(accounts[accountIndex]);
    oracles[result[2]].push(accounts[accountIndex]);
    accountIndex+=1;
  }

  console.log('Registered Oracles: ', oracles);

  return true;
}

const registerFlights = async () => {
  // register some flights here for testing the Dapp
  flights.forEach(async f => {
      await flightSuretyApp.methods.registerFlight(f[0], f[1]).send({ from: registeredAirline, gas: 30000000 });
      console.log("Registered Flight:", f);
    }
  );
}

const fetchFlightStatus = async (req) => {
  console.log('Fetching flight status for:', [req.index, req.airline, req.flight, req.timestamp])
  for(let i=0; i<oracles[req.index].length; i++) {
    // pick a status code at random for now!
    let status = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
    console.log("ORACLE USED: ",  oracles[req.index][i]);
    try {
      await flightSuretyApp.methods.submitOracleResponse(req.index, req.airline, req.flight, req.timestamp, status).send({from: oracles[req.index][i], gas: 30000000});
    } catch(e) {
      console.log(Object.keys(e))
      console.error("Oracle could not submit response: ", e.message);
    }
  }
}

// Setup function
(async () => {
  accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  console.log("DEFAULT ACCOUNT", web3.eth.defaultAccount);
  registeredAirline = accounts[1];
  await registerOracles();
  await registerFlights();
})();

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;