
var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  let newAirline = accounts[2];
  let nonRegisteredAirline = accounts[9];

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

  it('should not be possible to register an airline more than once', async () => {
      await truffleAssert.reverts(
          config.flightSuretyApp.registerAirline(config.firstAirline, {from: config.firstAirline}),
          'Airline is already successfully registered.'
      );
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
    let newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(newAirline);
    assert.equal(newAirlineRegisterd, false, 'Airline should not be registered yet')

    // Try registering a new airline from an account that is not registered as an airline should revert the transaction
    await truffleAssert.reverts(
        config.flightSuretyApp.registerAirline(newAirline, {from: nonRegisteredAirline }),
        'Caller must be a registered airline'
    );

    // Registering from the first airline account should successfully register the new airline
    await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline });

    newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(newAirline);
    assert.equal(newAirlineRegisterd, true, 'Airline was not registered correcty');
  });

  it('can register 4 airlines before consensus is requried to register more', async () => {
        // There will be two airlines registered at this point so lets register 3 more
        let newAirline3 = accounts[3];
        let newAirline4 = accounts[4];
        let newAirline5 = accounts[5]; // This one will be rejected due to consensus

        // Make sure the above 3 airlines are not yet registered
        let airline3Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline3);
        let airline4Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline4);
        let airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);

        assert.equal(airline3Registerd, false, 'Airline 3 should not be registered yet')
        assert.equal(airline4Registerd, false, 'Airline 4should not be registered yet')
        assert.equal(airline5Registerd, false, 'Airline 5 should not be registered yet')

        await config.flightSuretyApp.registerAirline(newAirline3, {from: config.firstAirline });
        await config.flightSuretyApp.registerAirline(newAirline4, {from: config.firstAirline });
        await config.flightSuretyApp.registerAirline(newAirline5, {from: config.firstAirline });

        airline3Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline3);
        airline4Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline4);
        airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);

        assert.equal(airline3Registerd, true, 'Airline 3 was not registered properly')
        assert.equal(airline4Registerd, true, 'Airline 4 was not registered properlyt')
        assert.equal(airline5Registerd, false, 'Airline 5 was registered when it should not have been')
  })

  it('re-registering the an airline more than once by the same airline should not increase the vote', async () => {
    let newAirline5 = accounts[5]; // This one will be rejected due to consensus
    await truffleAssert.reverts(
        config.flightSuretyApp.registerAirline(newAirline5, {from: config.firstAirline }),
        'Sender already cast vote for registering this airline'
    )
  })

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
