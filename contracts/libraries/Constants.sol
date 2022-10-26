//SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

library Constants {
    uint8 public constant MERKLE_TREE_DEPTH = 20; // maximum number of members a group can contain (max size = 2 ^ MERKLE_TREE_DEPTH).
}
