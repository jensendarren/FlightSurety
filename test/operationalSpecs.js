var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');

contract('Flight Surety Contraction Operational Tests', async (accounts) => {

  var config;
  let newAirline = accounts[2];

  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });

  it(`(multiparty) has correct initial isOperational() value`, async () => {
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async () => {
    await truffleAssert.reverts(
      config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] }),
      'Caller is not contract owner'
    )
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async () => {
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Contract is not initialized in an operational state");
    await config.flightSuretyData.setOperatingStatus(false);
    status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, false, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async  () => {
    await config.flightSuretyData.setOperatingStatus(false);
    await truffleAssert.reverts(
      config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline }),
      "Contract is currently not operational"
    )
    // Now set operational status to true so that at least we can get passed this requirement
    await config.flightSuretyData.setOperatingStatus(true);
    // The function will still revert, but for a different reason, meaning that the contract is now operartional again
    await truffleAssert.reverts(
      config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline }),
      "Airline connot vote until it funds the contract."
    )
  })
})