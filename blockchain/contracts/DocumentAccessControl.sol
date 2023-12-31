// blockchain/contracts/DocumentAccessControl.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentAccessControl is ERC721, Ownable {
    constructor(address initialOwner) ERC721("DocumentAccessControl", "DAC") Ownable(initialOwner) {}

    uint256 private _tokenIds;
    mapping(uint256 => uint256) private _tokenExpiryTimes;
    mapping(string => uint256) private _documentToTokenId;
    mapping(uint256 => string) private _tokenIdToDocumentId;

    mapping(uint256 => string) private _tokenHashes;

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

    // TOKEN CORE FUNCTIONALITY

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
            "ExbeforetokenIdpiry time must be greater than 0"
        );

        _tokenIds++;
        uint256 tokenId = _tokenIds;
        _mint(user, tokenId);

        _tokenExpiryTimes[tokenId] = block.timestamp + expiryInSeconds; // set custom expiry time
        _documentToTokenId[documentId] = tokenId;
        _tokenIdToDocumentId[tokenId] = documentId;
        _setTokenHash(tokenId, documentHash);

        emit AccessGranted(
            user,
            documentId,
            tokenId,
            block.timestamp,
            _tokenExpiryTimes[tokenId]
        );

        return tokenId;
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

    // UTILS

    // HAS ACCESS TO A SPECIFIC DOCUMENT
    function hasAccess(
        address user,
        string memory documentId
    ) public onlyOwnerOrUser(user) tokensExist returns (bool) {
        uint256 tokenId = _documentToTokenId[documentId];

        // check if token exists
        if (_tokenExpiryTimes[tokenId] == 0) {
            return false;
        }

        address owner = ownerOf(tokenId);
        return owner == user && isTokenValid(tokenId);
    }

    // TOKEN VALIDITY CHECK
    function isTokenValid(uint256 tokenId) public returns (bool) {
        bool isValid = _tokenExpiryTimes[tokenId] > block.timestamp;
        if (!isValid) {
            emit TokenExpired(tokenId);
        }
        return isValid;
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

    // OVERRIDE

    // override the tokenURI function to remove metadata URI functionality
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) tokensExist returns (string memory) {
        return _tokenHashes[tokenId];
    }

    // disable renounceOwnership
    function renounceOwnership() public view override onlyOwner {
        revert("Renouncing ownership is disabled");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
