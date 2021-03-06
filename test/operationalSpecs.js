var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');

contract('Flight Surety Contraction Operational Tests', async (accounts) => {

  var config;
  let newAirline = accounts[2];

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
  });

  it('has correct initial isOperational() value', async () => {
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it('can block access to setOperatingStatus() for non-Contract Owner account', async () => {
    await truffleAssert.reverts(
      config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] }),
      'Caller is not contract owner'
    )
  });

  it('can allow access to setOperatingStatus() for Contract Owner account', async () => {
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Contract is not initialized in an operational state");
    await config.flightSuretyData.setOperatingStatus(false);
    status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, false, "Access not restricted to Contract Owner");
  });

  it('can block access to functions using requireIsOperational when operating status is false', async  () => {
    await config.flightSuretyData.setAuthorizedCaller(config.owner);
    await config.flightSuretyData.setOperatingStatus(false);
    await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
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

  it('the app contract uses the operational status of the data contract', async () => {
    // Get the operational status from the app contract
    let status = await config.flightSuretyApp.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
    // Set the operational status via the data contract
    await config.flightSuretyData.setOperatingStatus(false);
    // Update the status via teh APP contract, it should match the same as the operational status in the data contract
    status = await config.flightSuretyApp.isOperational.call();
    assert.equal(status, false, "Incorrect initial operating status value");
  })
})