// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentAccessControl is ERC721, Ownable {
    constructor(
        address initialOwner
    ) ERC721("DocumentAccessControl", "DAC") Ownable(initialOwner) {}

    mapping(uint256 => uint256) private _tokenExpiryTimes;
    mapping(string => uint256) private _documentToTokenId;
    mapping(uint256 => string) private _tokenIdToDocumentId;
    mapping(uint256 => string) private _tokenHashes;
    mapping(bytes32 => Request) public accessRequests;

    uint256 private _tokenIds;

    uint256 public constant DEFAULT_EXPIRATION_PERIOD = 259200; // 3 days in seconds to avoid system being cluttered by pending reqs
    uint256 public constant SET_BACKUP_OWNER_TIMELOCK = 18000; // 5 hours timelock before changing to backupOwner
    uint256 private backupOwnerTimelockExpiry;

    address private pendingBackupOwner;
    address private _backupOwner;

    enum RequestStatus {
        None, // default value, used to indicate no request exists
        Pending,
        Approved,
        Rejected
    }

    // for incoming share requests
    struct Request {
        string documentId;
        address requester;
        address approver;
        RequestStatus status;
        uint256 requestTime;
        uint256 expirationTime;
        bool isInitialized;
        uint256 tokenId; // link tokens to requests
    }

    // events declaration
    event AccessGranted(
        address indexed user,
        string documentId,
        uint256 tokenId,
        uint256 timestamp,
        uint256 expiryTime
    );
    event AccessRevoked(
        address indexed user,
        string documentId,
        uint256 tokenId,
        uint256 timestamp,
        string reason
    );

    event TokenRenewed(uint256 indexed tokenId, uint256 newExpiryTime);
    event TokenExpired(uint256 tokenId);
    event DocumentAccessAttempt(
        address indexed user,
        string documentId,
        bool success,
        uint256 timestamp
    );
    event AccessDenied(address user, string documentId, string reason);
    event UnauthorizedAccessAttempt(
        address indexed user,
        string documentId,
        uint256 tokenId
    );

    event RequestReceived(
        string documentId,
        address requester,
        RequestStatus status
    );
    event RequestUpdated(
        string documentId,
        address approver,
        RequestStatus status,
        string reason
    );

    event BackupOwnerChanged(
        address indexed previousBackupOwner,
        address indexed newBackupOwner
    );

    // MODIFIERS

    // restrict access to the owner or the specified user
    modifier onlyOwnerOrUser(address user) {
        require(msg.sender == owner() || msg.sender == user, "Not authorized");
        _;
    }

    // explicitly forbid token transfer
    modifier onlyCustomTransfer(
        address from,
        address to,
        uint256 tokenId
    ) {
        require(msg.sender == address(this), "Must use customSafeTransferFrom");
        _;
    }

    //////////////////////////////
    // TOKEN CORE FUNCTIONALITY //
    //////////////////////////////

    // MINT NEW ACCESS TOKEN
    // allows minting a new access token either in response to an access request
    // or independently, without a preceding request
    function mintAccess(
        address user,
        string memory documentId,
        string memory documentHash,
        uint256 expiryInSeconds
    ) external onlyOwner returns (uint256) {
        require(bytes(documentId).length > 0, "Document ID cannot be empty");
        require(expiryInSeconds > 0, "Expiry time must be positive");

        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(user, newTokenId);

        bytes32 requestKey = keccak256(abi.encodePacked(documentId, user));
        Request storage existingRequest = accessRequests[requestKey];

        // check if there is an associated request
        if (existingRequest.isInitialized) {
            // if the request is expired, clean it up and revert
            if (existingRequest.expirationTime < block.timestamp) {
                delete accessRequests[requestKey];
                revert("Expired request. Please make a new request.");
            }

            // ensure the request status is Pending
            require(
                existingRequest.status == RequestStatus.Pending,
                "Request already handled or N/A"
            );

            // update request status to Approved
            existingRequest.status = RequestStatus.Approved;
            existingRequest.approver = msg.sender;
            existingRequest.tokenId = newTokenId; // link the token to the request
        }

        // set token data
        _tokenExpiryTimes[newTokenId] = block.timestamp + expiryInSeconds;
        _documentToTokenId[documentId] = newTokenId;
        _tokenIdToDocumentId[newTokenId] = documentId;
        _setTokenHash(newTokenId, documentHash);

        emit AccessGranted(
            user,
            documentId,
            newTokenId,
            block.timestamp,
            _tokenExpiryTimes[newTokenId]
        );

        return newTokenId;
    }

    // RENEW ACCESS FOR EXPIRED TOKEN
    function renewAccess(
        uint256 tokenId,
        uint256 additionalTimeInSeconds
    ) external onlyOwner {
        require(_tokenExpiryTimes[tokenId] != 0, "Token does not exist");
        require(
            _tokenExpiryTimes[tokenId] <= block.timestamp,
            "Token not yet expired"
        );

        _tokenExpiryTimes[tokenId] = block.timestamp + additionalTimeInSeconds;
        emit TokenRenewed(tokenId, _tokenExpiryTimes[tokenId]);
    }

    // REVOKE ACCESS: TOKEN BURN
    function revokeAccess(
        uint256 tokenId,
        string memory reason
    ) external onlyOwner {
        require(bytes(reason).length > 0, "Must provide reason string");

        require(_tokenExpiryTimes[tokenId] != 0, "Token does not exist");
        require(
            _tokenExpiryTimes[tokenId] > block.timestamp,
            "Token already expired"
        );

        // store the owner's address before burning the token
        address tokenOwner = ownerOf(tokenId);

        // store the document ID before burning the token
        string memory docId = _tokenIdToDocumentId[tokenId];
        bytes32 requestKey = keccak256(abi.encodePacked(docId, tokenOwner));
        if (accessRequests[requestKey].isInitialized) {
            accessRequests[requestKey].status = RequestStatus.None;
        }

        // revoke access & invalidate token
        _burn(tokenId);
        _tokenExpiryTimes[tokenId] = 0;

        // remove document reference and mapping

        delete _documentToTokenId[docId];
        delete _tokenIdToDocumentId[tokenId];

        emit AccessRevoked(tokenOwner, docId, tokenId, block.timestamp, reason);
    }

    ///////////
    // UTILS //
    ///////////

    // Utility function to check if a request exists and is pending
    function isRequestPending(
        string memory documentId,
        address requester
    ) public view returns (bool) {
        bytes32 requestKey = keccak256(abi.encodePacked(documentId, requester));
        Request memory request = accessRequests[requestKey];
        return request.isInitialized && request.status == RequestStatus.Pending;
    }

    // REQUEST ACCESS
    function requestAccess(
        string memory documentId,
        address requester
    ) external {
        bytes32 requestKey = keccak256(abi.encodePacked(documentId, requester));
        Request storage existingRequest = accessRequests[requestKey];

        // check if the request exists and is initialized
        if (existingRequest.isInitialized) {
            // if the request is expired, clean it up
            if (existingRequest.expirationTime < block.timestamp) {
                delete accessRequests[requestKey];
            } else {
                // if the request is still active (Pending or Approved), revert
                require(
                    existingRequest.status != RequestStatus.Approved,
                    "Access already granted"
                );
                require(
                    existingRequest.status != RequestStatus.Pending,
                    "Request already pending"
                );
            }
        }

        // create a new request
        accessRequests[requestKey] = Request({
            documentId: documentId,
            requester: requester,
            approver: address(0),
            status: RequestStatus.Pending,
            requestTime: block.timestamp,
            expirationTime: block.timestamp + DEFAULT_EXPIRATION_PERIOD,
            isInitialized: true,
            tokenId: 0 // initialize tokenId with a default value
        });

        emit RequestReceived(documentId, requester, RequestStatus.Pending);
    }

    // DENY REQUEST
    function denyRequest(
        string memory documentId,
        address requester,
        string memory reason
    ) external onlyOwner {
        bytes32 requestKey = keccak256(abi.encodePacked(documentId, requester));
        Request storage existingRequest = accessRequests[requestKey];

        // check if the request is valid for denial
        require(existingRequest.isInitialized, "Request does not exist");
        require(
            existingRequest.status == RequestStatus.Pending,
            "Request not valid for denial"
        );

        // if the request is expired, clean it up and revert
        if (existingRequest.expirationTime < block.timestamp) {
            delete accessRequests[requestKey];
            revert("Expired request. Please make a new request.");
        }

        // proceed with denying the request
        existingRequest.status = RequestStatus.Rejected;
        existingRequest.approver = msg.sender;
        existingRequest.expirationTime =
            block.timestamp +
            DEFAULT_EXPIRATION_PERIOD; // set an expiration for the rejection

        emit RequestUpdated(
            documentId,
            requester,
            RequestStatus.Rejected,
            reason
        );
    }

    // TOKEN VALIDITY CHECK
    function isTokenValid(uint256 tokenId) public returns (bool) {
        // Check if the token has been minted
        if (_tokenExpiryTimes[tokenId] == 0) {
            revert("Token does not exist or has been revoked");
        }

        bool isValid = _tokenExpiryTimes[tokenId] > block.timestamp;
        if (!isValid) {
            emit TokenExpired(tokenId);
        }
        return isValid;
    }

    // internal function to check if a user has access to a specific document
    // returns true if the user has access, false otherwise
    function _hasAccess(
        address user,
        string memory documentId
    ) internal returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];
        // check if token exists and is valid
        return
            (_tokenExpiryTimes[tokenId] != 0) &&
            (ownerOf(tokenId) == user) &&
            isTokenValid(tokenId);
    }

    // external function to check access to a document
    // logs the access attempt and returns the access status
    function hasAccess(
        address user,
        string memory documentId
    ) external returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];
        try this.isTokenValid(tokenId) returns (bool isValid) {
            if (isValid && ownerOf(tokenId) == user) {
                return true;
            }
        } catch {
            emit UnauthorizedAccessAttempt(user, documentId, tokenId);
        }
        return false;
    }

    // Internal function to log document access attempts
    function _logAccessAttempt(
        address user,
        string memory documentId,
        bool success
    ) internal {
        emit DocumentAccessAttempt(user, documentId, success, block.timestamp);
    }

    // GET ALL TOKEN DATA
    // including for expired tokens
    function getTokenData(
        uint256 tokenId
    )
        external
        onlyOwner
        returns (address owner, uint256 expiryTime, bool isValid)
    {
        require(_tokenExpiryTimes[tokenId] != 0, "Token does not exist");

        owner = ownerOf(tokenId);
        expiryTime = _tokenExpiryTimes[tokenId]; // expiry time from the mapping
        isValid = isTokenValid(tokenId); // check validity of the token

        return (owner, expiryTime, isValid);
    }

    // internal write hash to storage
    function _setTokenHash(
        uint256 tokenId,
        string memory documentHash
    ) internal {
        _tokenHashes[tokenId] = documentHash;
    }

    ///////////////
    // OVERRIDES //
    ///////////////

    // PREVENT TOKEN TRANSFERS
    // can't override safeTransfer in ERC721.sol
    // force all token transfers via own function which will revert
    function customSafeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public view onlyCustomTransfer(from, to, tokenId) {
        revert("All transfers disabled");
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override onlyCustomTransfer(from, to, tokenId) {
        // logic won't execute due to modifier revert
    }

    // override the tokenURI function to remove metadata URI functionality
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) returns (string memory) {
        return _tokenHashes[tokenId];
    }

    // disable inherited renounceOwnership
    function renounceOwnership() public view override onlyOwner {
        revert(
            "Renouncing ownership is disabled. Try transferring ownership to the backup owner instead."
        );
    }

    // TRANSFER OWNERSHIP TO BACKUP ACC
    function transferOwnershipToBackup() public {
        require(
            msg.sender == owner() || msg.sender == _backupOwner,
            "Can't transfer ownership to yourself!"
        );
        // check if timelock passed
        require(
            block.timestamp >= backupOwnerTimelockExpiry,
            "Timelock not expired"
        );

        // set pending address as new owner
        transferOwnership(pendingBackupOwner);

        // emit event
        emit BackupOwnerChanged(owner(), pendingBackupOwner);
    }

    // helper function
    function setPendingBackupOwner(address backupOwner) public onlyOwner {
        pendingBackupOwner = backupOwner;
        backupOwnerTimelockExpiry = block.timestamp + SET_BACKUP_OWNER_TIMELOCK;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
