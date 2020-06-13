var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');
// var BigNumber = require('bignumber.js');

contract('Flight Surety Airline Tests', async (accounts) => {

  var config;
  let newAirline = accounts[2];
  let newAirline3 = accounts[3];
  let newAirline4 = accounts[4];
  let newAirline5 = accounts[5];
  let nonRegisteredAirline = accounts[9];

  const AIRLINE_ANTE = web3.utils.toWei('10', 'ether');

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    // await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  describe('funding the contract', () => {
    it('should be not possible for a non registered airline to fund the contract', async () => {
      await truffleAssert.reverts(
        config.flightSuretyApp.fund({from: nonRegisteredAirline, value: AIRLINE_ANTE}),
        'Only registered airlines can fund contract.'
        )
      })
    it('should be not possible to send less than 10 ether to fund the contract', async () => {
      await truffleAssert.reverts(
        config.flightSuretyApp.fund({from: config.firstAirline, value: web3.utils.toWei('9', 'ether')}),
        'Insufficient funds sent. Please send at least 10 ether.'
        )
      })
    it('should be possible for a registered airline to send ether to fund the contract', async () => {
      startContractBal = BigInt(await web3.eth.getBalance(config.flightSuretyData.address));
      await config.flightSuretyApp.fund({from: config.firstAirline, value: AIRLINE_ANTE})
      endContractBal = BigInt(await web3.eth.getBalance(config.flightSuretyData.address));
      assert.equal(endContractBal - startContractBal, AIRLINE_ANTE, 'Contract did not receive expected ante mount');
      isAirlineFunded = await config.flightSuretyData.isAirlineFunded(config.firstAirline);
      assert.equal(isAirlineFunded, true, 'Airline was not updated as having funded the contract');
    })
  })

  describe('registering and voting for airlines', async () => {
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


      // Make sure the above 3 airlines are not yet registered
      let airline3Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline3);
      let airline4Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline4);
      let airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);

      assert.equal(airline3Registerd, false, 'Airline 3 should not be registered yet')
      assert.equal(airline4Registerd, false, 'Airline 4 should not be registered yet')
      assert.equal(airline5Registerd, false, 'Airline 5 should not be registered yet')

      await config.flightSuretyApp.registerAirline(newAirline3, {from: config.firstAirline });
      await config.flightSuretyApp.registerAirline(newAirline4, {from: config.firstAirline });
      await config.flightSuretyApp.registerAirline(newAirline5, {from: config.firstAirline });

      airline3Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline3);
      airline4Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline4);
      airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);

      assert.equal(airline3Registerd, true, 'Airline 3 was not registered properly')
      assert.equal(airline4Registerd, true, 'Airline 4 was not registered properly')
      assert.equal(airline5Registerd, false, 'Airline 5 was registered when it should not have been')
    })

    it('voting for the an airline more than once by the same airline should not increase the vote', async () => {
      let newAirline5 = accounts[5]; //eThis one will be rejected due to consensus
      await truffleAssert.reverts(
          config.flightSuretyApp.registerAirline(newAirline5, {from: config.firstAirline }),
          'Sender already cast vote for registering this airline'
      )
    })

    it('voting for the airline more than once by different airline should allow the vote to increase', async () => {
      let newAirline4 = accounts[4]; // new airline 4 will vote for
      let newAirline5 = accounts[5]; // new airline 5 which should be fine
      // make sure that newAirline4 has funded the contract otherwise this spec will fail
      await config.flightSuretyApp.fund({from: newAirline4, value: AIRLINE_ANTE})
      // now try to tegister / vote for a new airline and we should be good
      await config.flightSuretyApp.registerAirline(newAirline5, {from: newAirline4 });
      airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);
      assert.equal(airline5Registerd, true, 'Airline 5 was not registered properly')
    })

    it('an airline cannot vote to register another airline if it has not funded the contract', async () => {
      // note that newAirline3 should already be registed with the contract
      // ensure the airline has not yet funded the contract!
      isFunded = await config.flightSuretyData.isAirlineFunded(newAirline3);
      assert.equal(isFunded, false, 'Airline is funded when it should not be')

      await truffleAssert.reverts(
          config.flightSuretyApp.registerAirline(nonRegisteredAirline, {from: newAirline3}),
          'Airline connot vote until it funds the contract.'
      )

      isRegistered = await config.flightSuretyApp.isAirlineRegistered(nonRegisteredAirline);

      assert.equal(isRegistered, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });
  })
})