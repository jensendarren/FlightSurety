import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.registerEvents(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {

            this.owner = accts[0];

            let counter = 1;

            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }
            callback();
        });
    }

    async registerEvents(callback) {
        await this.flightSuretyApp.events.OracleReport({ fromBlock: 'latest' })
                .on('data', (e) => {
                    let event = new CustomEvent("OracleReportEvent", { "detail": e.returnValues.status })
                    document.dispatchEvent(event);
                })
                .on('changed', console.log)
                .on('error', console.log);

        await this.flightSuretyApp.events.FlightStatusInfo({ fromBlock: 'latest' })
                .on('data', (e) => {
                    let event = new CustomEvent("FlightStatusInfo", { "detail": e.returnValues.status })
                    document.dispatchEvent(event);
                })
                .on('changed', console.log)
                .on('error', console.log);
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, timestamp, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp,
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    buyInsurance(flight, timestamp, value,  callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp
        }
        self.flightSuretyApp.methods
            .buy(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.passengers[0],
                    value: this.web3.utils.toWei(value, 'Ether'),
                    gas: 300000
                }, (error, result) => {
                callback(error, payload)
            });
    }
}