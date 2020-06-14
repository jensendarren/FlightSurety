
var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');

contract('Flight Surety Oracle Tests', async (accounts) => {

  const TEST_ORACLES_COUNT = 20;
  const ORACLE_ACCOUNT_START_INDEX = 30; // make sure to start ganache cli with at least 50 accounts
  const FLIGHT_NUMBER = 'AC110';
  const FLIGHT_TIMESTAMP = '1591878209161'
  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;
  const STATUS_CODES = [STATUS_CODE_UNKNOWN, STATUS_CODE_ON_TIME, STATUS_CODE_LATE_AIRLINE, STATUS_CODE_LATE_WEATHER, STATUS_CODE_LATE_TECHNICAL, STATUS_CODE_LATE_OTHER];

  let passenger = accounts[2];
  let requestedOracleIndex;
  let selectedStatusCode;

  var config;
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

  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });

  it('can register oracles', async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
    let accountIndex = ORACLE_ACCOUNT_START_INDEX;

    // ACT
    for(let i=1; i<TEST_ORACLES_COUNT; i++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[accountIndex], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[accountIndex]});
      assert.equal(web3.utils.isBN(result[0]), true, 'Index 0 is not set');
      assert.equal(web3.utils.isBN(result[1]), true, 'Index 1 is not set');
      assert.equal(web3.utils.isBN(result[2]), true, 'Index 2 is not set');
      // console.log("RESULT",  result[0]);
      oracles[result[0]].push(accounts[accountIndex]);
      oracles[result[1]].push(accounts[accountIndex]);
      oracles[result[2]].push(accounts[accountIndex]);
      accountIndex+=1;
    }
    // console.log("ORACLES REGISTERED --", oracles);
  });

  describe('request flight status', () => {
    it('flight needs to be registered before requesting a flight status from an oracle', async () => {
      await truffleAssert.reverts(
        config.flightSuretyApp.fetchFlightStatus(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger}),
        'Flight must be registered'
      )
    })
    it('should be possible to request a flight status update from an oracle', async () => {
      // register the flight first
      await config.flightSuretyApp.registerFlight(FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: config.firstAirline});

      let tx = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger});

      truffleAssert.eventEmitted(tx, 'OracleRequest', (e) => {
        indexHasOracle = oracles[e.index].length > 0;
        requestedOracleIndex = e.index.toString(10);
        return  indexHasOracle &&
                (e.airline == config.firstAirline) &&
                (e.flight == FLIGHT_NUMBER) &&
                (e.timestamp == FLIGHT_TIMESTAMP);
      })
    })
  })
  describe('submit oracle response', () => {
    it('should not be possible to submit a response if the Oracle index does not match', async () => {
      let oracle = oracles[0][0];
      let badindex = 99;

      await truffleAssert.reverts(
        config.flightSuretyApp.submitOracleResponse(badindex, config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, STATUS_CODE_ON_TIME, {from: oracle}),
        'Index does not match oracle request'
      )
    })
    it('emits an OracleReport event when an Oracle calls submitOracleResponse function', async () => {
      let oracle = oracles[requestedOracleIndex][0];
      selectedStatusCode= STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];

      let tx = await config.flightSuretyApp.submitOracleResponse(requestedOracleIndex, config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, selectedStatusCode, {from: oracle});

      // console.log("Oracle Index, Address, Status", [requestedOracleIndex, oracle, status])

      truffleAssert.eventEmitted(tx, 'OracleReport', (e) => {
        return  (e.airline == config.firstAirline) &&
                (e.flight == FLIGHT_NUMBER) &&
                (e.timestamp == FLIGHT_TIMESTAMP) &&
                (e.status == selectedStatusCode)
      })
    })
    it('emits an FlightStatusInfo event when the min responses for a flight status update have been reached', async () => {
      // Make 2 more updates usuing the same status but with different oralces
      let oracle1 = oracles[requestedOracleIndex][1];
      let oracle2 = oracles[requestedOracleIndex][2];

      await config.flightSuretyApp.submitOracleResponse(requestedOracleIndex, config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, selectedStatusCode, {from: oracle1});
      let tx = await config.flightSuretyApp.submitOracleResponse(requestedOracleIndex, config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, selectedStatusCode, {from: oracle2});

      truffleAssert.eventEmitted(tx, 'FlightStatusInfo', (e) => {
        return  (e.airline == config.firstAirline) &&
                (e.flight == FLIGHT_NUMBER) &&
                (e.timestamp == FLIGHT_TIMESTAMP) &&
                (e.status == selectedStatusCode)
      })
    })
  })
});