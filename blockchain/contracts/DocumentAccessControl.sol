// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentAccessControl is ERC721, Ownable {
    constructor(
        address initialOwner
    ) ERC721("DocumentAccessControl", "DAC") Ownable(initialOwner) {}

    mapping(string => uint256) private _documentToTokenId;
    mapping(uint256 => string) private _tokenIdToDocumentId;
    mapping(uint256 => string) private _tokenHashes;
    mapping(bytes32 => Request) public accessRequests;
    mapping(string => uint256[]) private _revokedTokenIds;
    mapping(uint256 => TokenData) private _tokensData;

    uint256 private _tokenIds;

    uint256 public constant DEFAULT_EXPIRATION_PERIOD = 259200; // 3 days in seconds to avoid system being cluttered by pending reqs
    uint256 public constant SET_BACKUP_OWNER_TIMELOCK = 18000; // 5 hours timelock before changing to backupOwner
    uint256 private backupOwnerTimelockExpiry;

    address private pendingBackupOwner;
    address private _backupOwner;

    enum RequestStatus {
        None, // default value: no request exists
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

    struct TokenHistory {
        uint256 timestamp;
        string action; // "Granted", "Revoked", etc.
        string reason; // reason for the action, especially for revocations
    }

    struct TokenData {
        address tokenOwner;
        uint256 expiryTime;
        bool isRevoked;
        uint256 revokedTimestamp;
        TokenHistory[] history; // Array to store the history of the token
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

    event DocumentAccessAttempt(
        address indexed user,
        string documentId,
        bool success,
        uint256 timestamp
    );
    event DocumentAccessed(
        address indexed user,
        string documentId,
        uint256 timestamp
    );

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
            if (existingRequest.expirationTime < block.timestamp) {
                delete accessRequests[requestKey];
                revert("Expired request. Please make a new request.");
            } else {
                require(
                    existingRequest.status == RequestStatus.Pending,
                    "Request already handled"
                );
                // update request status to Approved
                existingRequest.status = RequestStatus.Approved;
                existingRequest.approver = msg.sender;
                existingRequest.tokenId = newTokenId; // link the token to the request
            }
        }

        // initialize or update token data in _tokensData
        _tokensData[newTokenId].tokenOwner = user;
        _tokensData[newTokenId].expiryTime = block.timestamp + expiryInSeconds;
        _tokensData[newTokenId].isRevoked = false;
        _tokensData[newTokenId].revokedTimestamp = 0;

        // add to document-token and token-document mappings
        _documentToTokenId[documentId] = newTokenId;
        _tokenIdToDocumentId[newTokenId] = documentId;

        // set token hash
        _setTokenHash(newTokenId, documentHash);

        // create a new TokenHistory instance and push it to the history array
        TokenHistory memory newHistory = TokenHistory({
            timestamp: block.timestamp,
            action: "Granted",
            reason: ""
        });
        _tokensData[newTokenId].history.push(newHistory);

        emit AccessGranted(
            user,
            documentId,
            newTokenId,
            block.timestamp,
            block.timestamp + expiryInSeconds
        );

        return newTokenId;
    }

    // RENEW ACCESS FOR EXPIRED TOKEN
    function renewAccess(
        uint256 tokenId,
        uint256 additionalTimeInSeconds
    ) external onlyOwner {
        require(_tokensData[tokenId].expiryTime != 0, "Token does not exist");
        require(!_tokensData[tokenId].isRevoked, "Token has been revoked");
        require(
            _tokensData[tokenId].expiryTime <= block.timestamp,
            "Token not yet expired"
        );

        // update the expiry time in _tokensData
        _tokensData[tokenId].expiryTime =
            block.timestamp +
            additionalTimeInSeconds;

        emit TokenRenewed(tokenId, _tokensData[tokenId].expiryTime);
    }

    // REVOKE ACCESS: TOKEN BURN
    function revokeAccess(
        uint256 tokenId,
        string memory reason
    ) external onlyOwner {
        require(bytes(reason).length > 0, "Must provide reason string");
        TokenData storage tokenData = _tokensData[tokenId];
        require(tokenData.expiryTime != 0, "Token does not exist");
        require(!tokenData.isRevoked, "Token already revoked");
        require(
            tokenData.expiryTime > block.timestamp,
            "Token already expired"
        );

        // store the owner's address before burning the token
        address tokenOwner = ownerOf(tokenId);

        // record the revocation details in the TokenData struct
        tokenData.isRevoked = true;
        tokenData.revokedTimestamp = block.timestamp;
        tokenData.expiryTime = 0; // set expiry time to 0 as it's revoked
        tokenData.tokenOwner = tokenOwner; // update owner before burning the token for token history/audit

        // store the document ID before burning the token
        string memory docId = _tokenIdToDocumentId[tokenId];
        _revokedTokenIds[docId].push(tokenId);

        // update request status
        bytes32 requestKey = keccak256(abi.encodePacked(docId, tokenOwner));
        if (accessRequests[requestKey].isInitialized) {
            accessRequests[requestKey].status = RequestStatus.None;
        }

        // push a new TokenHistory entry for the revocation
        tokenData.history.push(
            TokenHistory({
                timestamp: block.timestamp,
                action: "Revoked",
                reason: reason
            })
        );

        // burn the token
        _burn(tokenId);

        // remove document reference and mapping
        delete _documentToTokenId[docId];
        delete _tokenIdToDocumentId[tokenId];

        emit AccessRevoked(tokenOwner, docId, tokenId, block.timestamp, reason);
    }

    ///////////
    // UTILS //
    ///////////

    // Utility function to check if a request exists and is pending
    // to list out pending request quickly, or
    // to prevent duplicate requests
    function isRequestPending(
        string memory documentId,
        address requester
    ) external view returns (bool) {
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
    function isTokenValid(uint256 tokenId) public view returns (bool) {
        TokenData memory tokenData = _tokensData[tokenId];
        require(
            tokenData.expiryTime != 0,
            "Token does not exist or has been revoked"
        );

        bool isValid = tokenData.expiryTime > block.timestamp;

        return isValid;
    }

    function checkTokenValidity(uint256 tokenId) external view returns (bool) {
        TokenData memory tokenData = _tokensData[tokenId];
        require(
            tokenData.expiryTime != 0 || tokenData.isRevoked,
            "Token does not exist or was never issued"
        );

        // Check if the token is valid
        return tokenData.expiryTime > block.timestamp && !tokenData.isRevoked;
    }

    // internal function to check if a user has access to a specific document
    // returns true if the user has access, false otherwise
    function _hasAccess(
        address user,
        string memory documentId
    ) internal view returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];
        TokenData memory tokenData = _tokensData[tokenId];
        // check if token exists, is not revoked, and is valid
        return
            tokenData.expiryTime != 0 &&
            !tokenData.isRevoked &&
            (ownerOf(tokenId) == user) &&
            (tokenData.expiryTime > block.timestamp);
    }

    // external function to check access to a document
    // logs the access attempt and returns the access status
    function hasAccess(
        address user,
        string memory documentId
    ) external returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];
        TokenData memory tokenData = _tokensData[tokenId];
        bool success = false;

        if (tokenData.expiryTime != 0 && !tokenData.isRevoked) {
            if (
                tokenData.expiryTime > block.timestamp &&
                ownerOf(tokenId) == user
            ) {
                success = true;
            } else {
                emit UnauthorizedAccessAttempt(user, documentId, tokenId);
            }
        }

        _logAccessAttempt(user, documentId, success);
        return success;
    }

    // get all revoked tokens
    function getRevokedTokens(
        string memory documentId
    ) external view onlyOwner returns (uint256[] memory) {
        return _revokedTokenIds[documentId];
    }

    // internal function to log document access attempts
    function _logAccessAttempt(
        address user,
        string memory documentId,
        bool success
    ) internal {
        emit DocumentAccessAttempt(user, documentId, success, block.timestamp);
    }

    // GET ALL TOKEN DATA
    // including for expired and revoked tokens
    function getTokenData(
        uint256 tokenId
    )
        external
        view
        onlyOwner
        returns (
            address owner,
            uint256 expiryTime,
            bool isValid,
            bool isRevoked,
            uint256 revokedTimestamp
        )
    {
        TokenData memory tokenData = _tokensData[tokenId];
        require(
            tokenData.expiryTime != 0 || tokenData.isRevoked,
            "Token does not exist or was never issued"
        );

        owner = tokenData.tokenOwner;
        expiryTime = tokenData.expiryTime;
        isValid =
            (expiryTime != 0) &&
            (expiryTime > block.timestamp) &&
            !tokenData.isRevoked;
        isRevoked = tokenData.isRevoked;
        revokedTimestamp = tokenData.revokedTimestamp;

        return (owner, expiryTime, isValid, isRevoked, revokedTimestamp);
    }

    // get detailed information about a token && its history
    function getTokenDetails(
        uint256 tokenId
    )
        external
        view
        onlyOwner
        returns (
            address owner,
            uint256 expiryTime,
            bool isRevoked,
            uint256 revokedTimestamp,
            TokenHistory[] memory history
        )
    {
        require(
            _tokensData[tokenId].expiryTime != 0 ||
                _tokensData[tokenId].isRevoked,
            "Token does not exist or was never issued"
        );

        TokenData memory tokenData = _tokensData[tokenId];
        owner = tokenData.tokenOwner;
        expiryTime = tokenData.expiryTime;
        isRevoked = tokenData.isRevoked;
        revokedTimestamp = tokenData.revokedTimestamp;
        history = tokenData.history;

        return (owner, expiryTime, isRevoked, revokedTimestamp, history);
    }

    // internal write hash to storage
    // for tampering detection
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
