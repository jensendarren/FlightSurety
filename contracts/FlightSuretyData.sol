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

    // Struct for holding insuree data
    struct Insuree {
        address passenger;
        uint256 value;
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
    mapping(bytes32 => Insuree[]) flights;

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

    function isPassengerInsured(address insuree, address airline, string flight, uint256 timestamp) public view returns(bool) {
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        (address passenger, uint256 value) = findPassengerInFlight(insuree, _key);
        return passenger == insuree && value > 0;
    }

    function findPassengerInFlight(address insuree, bytes32 key) private returns (address passenger, uint256 value) {
        Insuree[] memory passengers = flights[key];
        Insuree memory foundPassenger;
        for (uint i = 0; i < passengers.length; i++) {
            if (passengers[i].passenger == insuree) {
                foundPassenger = passengers[i];
            }
        }
        return (foundPassenger.passenger, foundPassenger.value);
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
    function registerAirline(address airline, address voter) external requireAirlineFunded(voter) returns(bool success, uint8 votes) {
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
    function fund(address airline) public payable  {
        require(isAirlineRegistered(airline), "Only registered airlines can fund contract.");
        require(msg.value >= 10 ether, "Insufficient funds sent. Please send at least 10 ether.");
        // Log the balance transfer for the airline
        fundedAirlines[airline] = msg.value;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address insuree, address airline, string flight, uint256 timestamp) external payable {
        require(msg.value <= 1 ether, "Cannot buy insurance valued at more than 1 ether.");
        require(!registeredAirlines[insuree], "Airlines can not purchase passenger insturance.");
        require(!isPassengerInsured(insuree, airline, flight, timestamp), 'Cannot buy insurance for the same flight more than once.');

        Insuree memory passenger = Insuree({
            passenger: insuree,
            value: msg.value
        });

        bytes32 _key = getFlightKey(airline, flight, timestamp);

        flights[_key].push(passenger);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees() external pure {

    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay() external pure {
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
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
