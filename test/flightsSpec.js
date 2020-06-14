var Test = require('../config/testConfig.js');

contract('Flight Surety Airline Tests', async (accounts) => {

  var config;

  const FLIGHT_NUMBER = 'AC110';
  const FLIGHT_TIMESTAMP = '1591878209161'

  before('setup contract', async () => {
    config = await Test.Config(accounts);
  })

  describe('registering flights', () => {
    it('should be possible to register a flight', async () => {
      await config.flightSuretyApp.registerFlight(FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: config.firstAirline});
    })
  })
})