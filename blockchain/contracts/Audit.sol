// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract Audit {
    // record tampering evidence
    event TamperingDetected(
        string indexed documentId,
        string oldHash,
        string newHash,
        uint256 timestamp
    );

    function logTampering(
        string memory documentId,
        string memory oldHash,
        string memory newHash
    ) public {
        emit TamperingDetected(documentId, oldHash, newHash, block.timestamp);
    }
}
