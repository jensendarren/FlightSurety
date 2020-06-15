pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;
    using SafeMath for uint8;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    address private authorizedCaller;                                   // Authorized app contract to call the contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    // Struct for holding instance amounts paid in and due (if flight is delayed)
    struct Insurance {
        uint256 paidIn; // the amount they paid in when the purchased the insurance
        uint256 creditDue; // the amount of credit that is due based on the insurance event
    }

    mapping(address => bool) public registeredAirlines;
    // map the balance of ether for each airline in this contract
    mapping(address => uint256) fundedAirlines;
    // map the insured passengers on each flight
    mapping(bytes32 => mapping(address => Insurance)) flights;
    // map the passnger address on each flight
    mapping(bytes32 => address[]) passengers;

    uint8 public airlineRegisteredCounter = 1;

    event InsurancePayoutPaid(address passenger, uint256 payment);

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

    /**
    * @dev Modifier that requires the "AuthorizedCaller" account to be the function caller
    */
    modifier requireAuthorizedCaller() {
        require(msg.sender == authorizedCaller, "Caller is not an authorized caller");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
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
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function setAuthorizedCaller(address appContract) requireContractOwner external {
        authorizedCaller = appContract;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address airline) external requireAuthorizedCaller requireIsOperational {
        // Add the airline to the list of registered airlines
        registeredAirlines[airline] = true;
        // Increment the number of registered airlines counter
        airlineRegisteredCounter = uint8(airlineRegisteredCounter.add(1));
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(address airline) requireIsOperational requireAuthorizedCaller external payable {
        fundedAirlines[airline] = msg.value;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address passenger, address airline, string flight, uint256 timestamp)
        requireIsOperational requireAuthorizedCaller external payable {
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
    function creditInsurees(address airline, string flight, uint256 timestamp, uint8 percentage)
        requireAuthorizedCaller requireIsOperational external {
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        for (uint256 i = 0; i < passengers[_key].length; i++) {
            address passenger = passengers[_key][i];
            flights[_key][passenger].creditDue = flights[_key][passenger].paidIn.mul(percentage).div(100);
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passenger, address airline, string flight, uint256 timestamp)
        requireAuthorizedCaller requireIsOperational external {
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        require(isPassengerInsured(passenger, _key), 'Passenger is not insured.');
        require(flights[_key][passenger].creditDue > 0, 'There is no payment due for this passenger.');

        uint256 payment = flights[_key][passenger].creditDue;
        flights[_key][passenger].creditDue = 0;
        address(uint160(passenger)).transfer(payment);
        emit InsurancePayoutPaid(passenger, payment);
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
