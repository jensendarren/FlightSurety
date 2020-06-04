
var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    // await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it('deployed data contract has first airline registered', async () => {
    let firstAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(config.firstAirline);
    assert.equal(firstAirlineRegistered, true, 'First airline is not registered as expected');
  })

  it('isAirlineRegistered should return if the airline is registered or not', async () => {
    // for the firstAirline it should  already return true
    let firstAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(config.firstAirline);
    assert.equal(firstAirlineRegistered, true, 'First airline is not registered as expected');
    // any other valid accounts should not be registered as an airline
    let newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(accounts[9]);
    assert.equal(newAirlineRegisterd, false, 'Airline is marked as registered when it should not be')
  });

  it('only registered airlines can register a new airline', async () => {
    let newAirline = accounts[2];
    let nonRegisteredAccount = accounts[9];

    let newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(newAirline);
    assert.equal(newAirlineRegisterd, false, 'Airline should not be registered yet')

    // Try registering a new airline from an account that is not registered as an airline should revert the transaction
    await truffleAssert.reverts(
        config.flightSuretyApp.registerAirline(newAirline, {from: nonRegisteredAccount }),
        'Caller must be a registered airline'
    );

    // Registering from the first airline account should successfully register the new airline
    await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline });

    newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(newAirline);
    assert.equal(newAirlineRegisterd, true, 'Airline was not registered correcty');
  });

  xit(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  xit(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

  });

  xit(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

  });

  xit(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  xit('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });


});
