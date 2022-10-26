//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

library Errors {
    error DoubleVoting();
    error PollIdIsNotLessThanSnarkScalarField();
    error PollAlreadyExists();
    error CallerIsNotThePollRelay();
}
