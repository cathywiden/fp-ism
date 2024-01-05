// blockchain/contracts/DocumentAccessControl.sol

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
    uint256 public constant DEFAULT_EXPIRATION_PERIOD = 604800; // 7 days in seconds to avoid system being cluttered by pending reqs
    uint256 public constant SET_BACKUP_OWNER_TIMELOCK = 18000; // 5 hours timelock before changing to backupOwner
    uint256 private backupOwnerTimelockExpiry;

    address private pendingBackupOwner;
    address private _backupOwner;

    enum RequestStatus {
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
    event DocumentAccessed(address user, string documentId, bool accessGranted);
    event AccessDenied(address user, string documentId, string reason);

    event RequestReceived(
        string documentId,
        address requester,
        RequestStatus status
    );
    event RequestUpdated(
        string documentId,
        address approver,
        RequestStatus status
    );

    event BackupOwnerChanged(
        address indexed previousBackupOwner,
        address indexed newBackupOwner
    );

    // MODIFIERS

    // check token existence
    modifier tokensExist() {
        require(_tokenIds > 0, "No tokens exist yet");
        _;
    }

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
    function mintAccess(
        address user,
        string memory documentId,
        string memory documentHash,
        uint256 expiryInSeconds
    ) external onlyOwner returns (uint256) {
        require(
            bytes(documentId).length > 0,
            "Document ID field cannot be empty"
        );
        require(
            expiryInSeconds > 0,
            "ExbeforenewTokenIdpiry time must be greater than 0"
        );

        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(user, newTokenId);

        _tokenExpiryTimes[newTokenId] = block.timestamp + expiryInSeconds; // set custom expiry time
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

        // renew only if token is expired (not revoked)
        _tokenExpiryTimes[tokenId] = block.timestamp + additionalTimeInSeconds;

        emit TokenRenewed(tokenId, _tokenExpiryTimes[tokenId]);
    }

    // REVOKE ACCESS: TOKEN BURN
    function revokeAccess(
        uint256 tokenId,
        string memory reason
    ) external onlyOwner {
        // require reason string
        require(bytes(reason).length > 0, "Must provide reason string");

        // check if token exists
        require(_tokenExpiryTimes[tokenId] != 0, "Nonexistent token");

        // check expiry status
        require(
            _tokenExpiryTimes[tokenId] > block.timestamp,
            "Token already expired"
        );

        // store the owner's address before burning the token
        address tokenOwner = ownerOf(tokenId);

        // store the document ID before burning the token
        string memory docId = _tokenIdToDocumentId[tokenId];

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

    // TOKEN VALIDITY CHECK
    function isTokenValid(uint256 tokenId) public returns (bool) {
        bool isValid = _tokenExpiryTimes[tokenId] > block.timestamp;
        if (!isValid) {
            emit TokenExpired(tokenId);
        }
        return isValid;
    }

    // HAS ACCESS
    // has access to a specific document
    function hasAccess(
        address user,
        string memory documentId
    ) external onlyOwnerOrUser(user) tokensExist returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];

        // check if token exists
        if (_tokenExpiryTimes[tokenId] == 0) {
            // denied access, you can provide a standard reason or customize it
            emit AccessDenied(
                user,
                documentId,
                "Access token does not exist or is expired"
            );
            return false;
        }
        address owner = ownerOf(tokenId);

        // evaluate access
        bool hasValidAccess = owner == user && isTokenValid(tokenId);

        // log result
        emit DocumentAccessed(user, documentId, hasValidAccess);

        return hasValidAccess;
    }

    // REQUEST ACCESS
    function requestAccess(
        string memory documentId,
        address requester
    ) external {
        bytes32 requestKey = keccak256(abi.encodePacked(documentId, requester));
        require(!accessRequests[requestKey].isInitialized, "Request exists");

        accessRequests[requestKey] = Request({
            documentId: documentId,
            requester: requester,
            approver: address(0),
            status: RequestStatus.Pending,
            requestTime: block.timestamp,
            expirationTime: block.timestamp + DEFAULT_EXPIRATION_PERIOD,
            isInitialized: true
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
        Request storage request = accessRequests[requestKey];

        require(request.isInitialized, "Request does not exist");
        require(
            request.status == RequestStatus.Pending,
            "Request already handled"
        );

        request.status = RequestStatus.Rejected;
        request.approver = msg.sender;

        emit AccessDenied(requester, documentId, reason);
    }

    // GET ALL TOKEN DATA
    // including for expired tokens
    function getTokenData(
        uint256 tokenId
    )
        external
        onlyOwner
        tokensExist
        returns (address owner, uint256 expiryTime, bool isValid)
    {
        if (_tokenExpiryTimes[tokenId] == 0) {
            return (address(0), 0, false);
        }

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

    // custom code to force all token transfers via own function which will revert
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

    ///////////////
    // OVERRIDES //
    ///////////////

    // override the tokenURI function to remove metadata URI functionality
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) tokensExist returns (string memory) {
        return _tokenHashes[tokenId];
    }

    // disable inherited renounceOwnership
    function renounceOwnership() public view override onlyOwner {
        revert(
            "Renouncing ownership is disabled. Try transferring ownership to the backup owner instead."
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
