pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)
    using SafeMath for uint8;
    FlightSuretyData flightSuretyData; // variable to reference the data contract

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 timestamp;
        string number;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    uint8 private constant INSUREES_PAYOUT_PERCENTAGE = 150;

    // map nominated airline address to vote counter of voting airline
    mapping(address => uint8) private nominatedAirlines;
    // map the airline that voted for which airline
    // to make sure they can only vote once
    mapping(address => mapping(address => bool)) private votedAirlines;


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
        require(isOperational(), "Contract is currently not operational");
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
     * @dev Modifier that ensures teh msg.sender is a registered airline
     */
     modifier requireAirlineRegistered() {
         require(isAirlineRegistered(msg.sender), "Caller must be a registered airline");
         _;
     }

    modifier requireAirlineFunded() {
        require(isAirlineFunded(msg.sender), "Airline connot vote until it funds the contract.");
        _;
    }

    modifier requireFlightRegistered(bytes32 key) {
         require(flights[key].isRegistered, "Flight must be registered");
         _;
     }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) {
        return flightSuretyData.isOperational();
    }

    function isAirlineRegistered(address airline) public view returns(bool) {
        return flightSuretyData.isAirlineRegistered(airline);
    }

    function isAirlineFunded(address airline) public view returns(bool) {
        return flightSuretyData.isAirlineFunded(airline);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline(address airline) external
        requireIsOperational requireAirlineRegistered requireAirlineFunded returns(bool success, uint8 votes) {
        require(!isAirlineRegistered(airline), "Airline is already successfully registered.");
        require(!votedAirlines[msg.sender][airline], "Sender already cast vote for registering this airline");

        success = false;
        // keep a track of which airline the sender voted for
        votedAirlines[msg.sender][airline] = true;
        // Increment vote counter for the nominated airline
        nominatedAirlines[airline] = uint8(nominatedAirlines[airline].add(1));
        votes = nominatedAirlines[airline];

        if (airlineRegistrationConsensusReached(votes)) {
            flightSuretyData.registerAirline(airline);
        }
        return (success, votes);
    }

    function airlineRegistrationConsensusReached(uint8 votes) internal view returns(bool) {
        if (flightSuretyData.airlineRegisteredCounter() < 4) {
            return true;
        }
        // Return if the vote amounts to more than 50% of the registered airlines
        return (votes.mul(2) >= flightSuretyData.airlineRegisteredCounter());
    }

    /**
    * @dev Funds the smart contract
    * The funds are forwared to the data contract
    *
    */
    function fund() requireIsOperational payable public {
        require(isAirlineRegistered(msg.sender), "Only registered airlines can fund contract.");
        require(msg.value >= 10 ether, "Insufficient funds sent. Please send at least 10 ether.");
        flightSuretyData.fund.value(msg.value)(msg.sender);
    }

    function buy(address airline, string flight, uint256 timestamp)
        requireIsOperational requireFlightRegistered(getFlightKey(airline, flight, timestamp)) payable public {
        require(isAirlineRegistered(airline), "The airline must be registered to buy insurance.");
        require(!isAirlineRegistered(msg.sender), "Airlines can not purchase passenger insturance.");
        require(msg.value <= 1 ether, "Cannot buy insurance valued at more than 1 ether.");
        require(msg.value > 0, "Cannot buy insurance without any value.");
        flightSuretyData.buy.value(msg.value)(msg.sender, airline, flight, timestamp);
    }

    function pay(address airline, string flight, uint256 timestamp) requireIsOperational payable public {
        flightSuretyData.pay(msg.sender, airline, flight, timestamp);
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight(string number, uint256 timestamp) requireIsOperational requireAirlineRegistered() external {
        bytes32 _key = getFlightKey(msg.sender, number, timestamp);
        Flight memory flight = Flight({
            statusCode: STATUS_CODE_UNKNOWN,
            isRegistered: true,
            airline: msg.sender,
            number: number,
            timestamp: timestamp
        });
        flights[_key] = flight;
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode) requireIsOperational internal {
        // update the flight mapping with the new statis
        bytes32 _key = getFlightKey(airline, flight, timestamp);
        flights[_key].statusCode = statusCode;
        // if the status is STATUS_CODE_LATE_AIRLINE then credit the insureed passengers
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            flightSuretyData.creditInsurees(airline, flight, timestamp, INSUREES_PAYOUT_PERCENTAGE);
        }
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus (address airline, string flight, uint256 timestamp)
            requireIsOperational requireFlightRegistered(getFlightKey(airline, flight, timestamp)) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes() view external returns(uint8[3]) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }


    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string flight, uint256 timestamp, uint8 statusCode) external {
        require((oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
                "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request or the request is closed");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // close the requirement to respond
            oracleResponses[key].isOpen = false;

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey(address airline, string flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}

// region FlightSuretyData interface
contract FlightSuretyData {
    uint8 public airlineRegisteredCounter;
    function isOperational() external returns(bool);
    function isAirlineRegistered(address airline) external returns(bool);
    function isAirlineFunded(address airline) external returns(bool);
    function registerAirline(address airline) external;
    function fund(address airline) external payable;
    function buy(address insuree, address airline, string flight, uint256 timestamp) external payable;
    function pay(address insuree, address airline, string flight, uint256 timestamp) external payable;
    function creditInsurees(address airline, string flight, uint256 timestamp, uint8 percentage) external;
}
// endregion