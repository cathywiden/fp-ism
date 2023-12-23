// blockchain/contracts/DocumentAccessControl.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentAccessControl is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    mapping(uint256 => uint256) private _tokenExpiryTimes;

    constructor(
        address initialOwner
    ) ERC721("DocumentAccessControl", "DAC") Ownable(initialOwner) {}

    // mint a new access token with a 1-week validity or until revocation
    function mintAccess(
        address user,
        string memory documentId,
        string memory metadataURI
    ) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        _mint(user, newItemId);

        // use documentId directly as part of metadataURI (placeholder)
        string memory fullMetadataURI = string(
            abi.encodePacked(metadataURI, documentId)
        );
        _setTokenURI(newItemId, fullMetadataURI);

        // token to expire in 1 week (604800 seconds)
        _tokenExpiryTimes[newItemId] = block.timestamp + 604800;

        return newItemId;
    }

    // convert uint256 to string
    function uint256ToString(
        uint256 value
    ) internal pure returns (string memory) {
        return Strings.toString(value);
    }

    // burn a token, revoking access
    function revokeAccess(uint256 tokenId) public onlyOwner {
        _burn(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // check if a user has access to a specific document
    function hasAccess(
        address user,
        uint256 documentId
    ) public view returns (bool) {
        address owner = ownerOf(documentId);

        if (owner == address(0)) {
            return false;
        }

        return owner == user && isTokenValid(documentId);
    }

    // check if a token is still valid
    function isTokenValid(uint256 tokenId) public view returns (bool) {
        return _tokenExpiryTimes[tokenId] > block.timestamp;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        require(
            isTokenValid(tokenId),
            "ERC721Metadata: URI query for expired token"
        );
        return super.tokenURI(tokenId);
    }
}