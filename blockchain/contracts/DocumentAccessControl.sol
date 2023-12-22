// blockchain/contracts/DocumentAccessControl.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentAccessControl is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    mapping(uint256 => uint256) private _tokenExpiryTimes;

    constructor(address initialOwner) ERC721("DocumentAccessControl", "DAC") Ownable(initialOwner) {}

    // Function to mint a new access token with a 1-week validity
    function mintAccess(address user, string memory metadataURI)
        public
        onlyOwner
        returns (uint256)
    {
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        _mint(user, newItemId);
        _setTokenURI(newItemId, metadataURI);

        // Set the token to expire in 1 week (604800 seconds)
        _tokenExpiryTimes[newItemId] = block.timestamp + 604800;

        return newItemId;
    }

    // Function to burn a token, revoking access
    function revokeAccess(uint256 tokenId) public onlyOwner {
        _burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Function to check if a user has access to a specific document
    function hasAccess(address user, uint256 documentId)
        public
        view
        returns (bool)
    {
        address owner = ownerOf(documentId);

        if (owner == address(0)) {
            return false;
        }

        return owner == user && isTokenValid(documentId);
    }

    // Function to check if a token is still valid
    function isTokenValid(uint256 tokenId) public view returns (bool) {
        return _tokenExpiryTimes[tokenId] > block.timestamp;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        require(
            isTokenValid(tokenId),
            "ERC721Metadata: URI query for expired token"
        );
        return super.tokenURI(tokenId);
    }
}
