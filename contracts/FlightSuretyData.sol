pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;
    using SafeMath for uint8;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    // Struct for holding instance amounts paid in and due (if flight is delayed)
    struct Insurance {
        uint256 paidIn; // the amount they paid in when the purchased the insurance
        uint256 creditDue; // the amount of credit that is due based on the insurance event
    }

    mapping(address => bool) public registeredAirlines;
    // map nominated airline address to vote counter of voting airline
    mapping(address => uint8) public nominatedAirlines;
    // map the airline that voted for which airline
    // to make sure they can only vote once
    mapping(address => mapping(address => bool)) public votedAirlines;
    // map the balance of ether for each airline in this contract
    mapping(address => uint256) fundedAirlines;
    // map the insured passengers on each flight
    mapping(bytes32 => mapping(address => Insurance)) flights;
    // map the passnger address on each flight
    mapping(bytes32 => address[]) passengers;

    uint8 airlineRegisteredCounter = 1;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public {
        contractOwner = msg.sender;
        registeredAirlines[firstAirline] = true;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAirlineFunded(address airline) {
        require(isAirlineFunded(airline), "Airline connot vote until it funds the contract.");
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isAirlineRegistered(address airline) public view returns(bool) {
        return registeredAirlines[airline];
    }

    function isAirlineFunded(address airline) public view returns(bool) {
        return fundedAirlines[airline] > 0;
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool) {
        return operational;
    }

    function isPassengerInsured(address passenger, bytes32 flightKey) public view returns(bool) {
        Insurance memory insured = flights[flightKey][passenger];
        return insured.paidIn > 0;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus (bool mode) external requireContractOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address airline, address voter) external
        requireIsOperational requireAirlineFunded(voter) returns(bool success, uint8 votes) {
        require(!registeredAirlines[airline], "Airline is already successfully registered.");
        require(!votedAirlines[voter][airline], "Sender already cast vote for registering this airline");

        success = false;
        // keep a track of which airline the sender voted for
        votedAirlines[voter][airline] = true;
        // Increment vote counter for the nominated airline
        nominatedAirlines[airline] = uint8(nominatedAirlines[airline].add(1));
        votes = nominatedAirlines[airline];

        if (airlineRegistrationConsensusReached(votes)) {
            success = true;
            // Add the airline to the list of registered airlines
            registeredAirlines[airline] = success;
            // Increment the number of registered airlines counter
            airlineRegisteredCounter = uint8(airlineRegisteredCounter.add(1));
        }

        return (success, votes);
    }

    function airlineRegistrationConsensusReached(uint8 votes) internal view returns(bool) {
        if (airlineRegisteredCounter < 4) {
            return true;
        }
        // Return if the vote amounts to more than 50% of the registered airlines
        return (votes.mul(2) >= airlineRegisteredCounter);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(address airline) requireIsOperational public payable  {
        require(isAirlineRegistered(airline), "Only registered airlines can fund contract.");
        require(msg.value >= 10 ether, "Insufficient funds sent. Please send at least 10 ether.");
        // Log the balance transfer for the airline
        fundedAirlines[airline] = msg.value;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address passenger, address airline, string flight, uint256 timestamp) requireIsOperational external payable {
        require(isAirlineRegistered(airline), "The airline must be registered to buy insurance.");
        require(msg.value <= 1 ether, "Cannot buy insurance valued at more than 1 ether.");
        require(msg.value > 0, "Cannot buy insurance without any value.");
        require(!registeredAirlines[passenger], "Airlines can not purchase passenger insturance.");
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        require(!isPassengerInsured(passenger, _key),
            'Cannot buy insurance for the same flight more than once.');

        Insurance memory insured = Insurance({
            paidIn: msg.value,
            creditDue: 0
        });

        flights[_key][passenger] = insured;

        // add to the passengers list for the flight
        passengers[_key].push(passenger);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address airline, string flight, uint256 timestamp) requireIsOperational external {
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        for (uint256 i = 0; i < passengers[_key].length; i++) {
            address passenger = passengers[_key][i];
            flights[_key][passenger].creditDue = flights[_key][passenger].paidIn.mul(15).div(10);
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passenger, address airline, string flight, uint256 timestamp) requireIsOperational external view {
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        require(isPassengerInsured(passenger, _key), 'Passenger is not insured.');
        require(flights[_key][passenger].creditDue > 0, 'There is no payment due for this passenger.');

        uint256 payment = flights[_key][passenger].creditDue;
        flights[_key][passenger].creditDue = 0;
        address(uint160(passenger)).transfer(payment);
        // emit InsurancePayoutPaid(passenger, payment);
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {
        fund(msg.sender);
    }
}
