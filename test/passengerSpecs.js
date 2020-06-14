var Test = require('../config/testConfig.js');
var truffleAssert = require('truffle-assertions');
var BigNumber = require('bignumber.js');

contract('Flight Surety Passenger Tests', async (accounts) => {

  var config;
  let newAirline = accounts[2];
  let passenger1 = accounts[6];
  let passenger2 = accounts[7];
  let passenger3 = accounts[8];

  const FLIGHT_NUMBER = 'AC110';
  const FLIGHT_TIMESTAMP = '1591878209161'
  const FLIGHT_KEY = '0x9ade82db5b73ee2f831ed8e5250ec1c25ca144e93a2c2763385b823aa4ba5dff'
  const NON_VALID_FLIGHT_KEY = '0xdebdf334a196e44c8850aa8cc16dd5970e9ec484150c295329c72af6cadb24cd'

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  describe('passenger / insuree contract interaction', () => {
    it('should not be possible to purchase insurance for an non registered flight', async () => {
      await truffleAssert.reverts(
        config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1, value: web3.utils.toWei('1', 'Ether')}),
        'Flight must be registered'
      )
    })
    describe('Passenger Buy Insurance', () => {
      before(async () => {
        await config.flightSuretyApp.registerFlight(FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: config.firstAirline});
      })
      it('should not be possible to purchase insurance valued more than 1 ether', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1, value: web3.utils.toWei('1.1', 'Ether')}),
          'Cannot buy insurance valued at more than 1 ether.'
        )
      })
      it('should not be possible to purchase insurance without any value', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1, value: web3.utils.toWei('0', 'Ether')}),
          'Cannot buy insurance without any value.'
        )
      })
      it('should not be a registed airline makeing an instance purchase', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: config.firstAirline, value: web3.utils.toWei('1', 'Ether')}),
          'Airlines can not purchase passenger insturance.'
        )
      })
      it('uninsured passengers should not be returned as insured for a particular flight', async () =>{
        isPassengerInsrured = await config.flightSuretyData.isPassengerInsured(passenger1, FLIGHT_KEY);
        assert.equal(isPassengerInsrured, false, 'Passenger was marked as insured for a flight when they should not be.');
      })
      it('should be possible to purchase insurance for 1 ether or less', async () => {
        await config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1, value: web3.utils.toWei('1', 'Ether')});
        //check isinsured
        isPassengerInsrured = await config.flightSuretyData.isPassengerInsured(passenger1, FLIGHT_KEY);
        assert.equal(isPassengerInsrured, true, 'Passenger was not marked as insured for this flight');
      })
      it('insured passengers for one flight should not insured on another flight', async () =>{
        isPassengerInsrured = await config.flightSuretyData.isPassengerInsured(passenger1, NON_VALID_FLIGHT_KEY);
        assert.equal(isPassengerInsrured, false, 'Passenger was marked as insured for a flight when they should not be.');
      })
      it('should not be possible to purcahse the insurance for the same flight more than once', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1, value: web3.utils.toWei('0.9', 'Ether')}),
          'Cannot buy insurance for the same flight more than once.'
        )
      })
    })

    describe('Passenger Payout', () => {
      before(async () => {
        // fund the contract so that we can make payouts!
        await web3.eth.sendTransaction({from: config.firstAirline, to: config.flightSuretyData.address, value: web3.utils.toWei('10', 'Ether')})
      })
      it('the passenger must be insured for the flight to be paid', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger2}),
          'Passenger is not insured.'
        )
      })
      it('the passenger should not receive any funds when there is no payout due', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1}),
          'There is no payment due for this passenger.'
        )
      })
      it('is possible to credit insurers and make a payout', async () => {
        await config.flightSuretyData.setAuthorizedCaller(config.owner);
        await config.flightSuretyData.creditInsurees(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP);
        await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);

        let startBalance = BigNumber(await web3.eth.getBalance(passenger1));
        let tx = await config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1});
        let gasPrice = BigNumber(await web3.eth.getGasPrice())
        let txGasFee = BigNumber(tx.receipt.gasUsed * gasPrice)
        let endBalance =  BigNumber(await web3.eth.getBalance(passenger1));
        let payoutAmount = BigNumber(web3.utils.toWei('1.5', 'ether'));
        let expectedBalance = startBalance.minus(txGasFee).plus(payoutAmount);

        assert.equal(endBalance.isEqualTo(expectedBalance), true, 'Payment was not issued');
      })
      it('should not be possible to withdraw insurance payout more than once', async () => {
        await truffleAssert.reverts(
          config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, {from: passenger1}),
          'There is no payment due for this passenger.'
        )
      })
    })
  })
});