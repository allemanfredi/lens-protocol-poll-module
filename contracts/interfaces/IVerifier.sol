//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IVerifier {
    function verifyProof(
        uint256[2] memory _a,
        uint256[2][2] memory _b,
        uint256[2] memory _c,
        uint256[4] memory _input
    ) external view;
}
