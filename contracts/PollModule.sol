//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IReferenceModule} from "@aave/lens-protocol/contracts/interfaces/IReferenceModule.sol";
import {ModuleBase} from "@aave/lens-protocol/contracts/core/modules/ModuleBase.sol";
import {IncrementalBinaryTree, IncrementalTreeData} from "@zk-kit/incremental-merkle-tree.sol/IncrementalBinaryTree.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {Constants} from "./libraries/Constants.sol";
import {Errors} from "./libraries/Errors.sol";

contract PollModule is ModuleBase, IReferenceModule, Context {
    using IncrementalBinaryTree for IncrementalTreeData;

    struct Poll {
        uint256 profileId;
        uint256 id;
    }

    mapping(uint256 => Poll) internal polls;
    mapping(uint256 => bool) internal nullifierHashes;
    mapping(uint256 => IncrementalTreeData) internal merkleTree;

    IVerifier internal verifier;
    address public immutable relay;
    uint256 pollsCounter;

    event VoteAdded(uint256 indexed pollId, bytes32 vote);
    event PollCreated(uint256 indexed pollId, uint256 indexed profileId);

    modifier onlyRelay() {
        if (relay != _msgSender()) {
            revert Errors.CallerIsNotThePollRelay();
        }

        _;
    }

    constructor(
        address _hub,
        address _verifierAddress,
        address _relayAddress
    ) ModuleBase(_hub) {
        verifier = IVerifier(_verifierAddress);
        relay = _relayAddress;
        pollsCounter = 1;
        // TODO: implement restricted vote
    }

    function initializeReferenceModule(
        uint256 _profileId,
        uint256 _pubId,
        bytes calldata /*_data*/
    ) external override onlyHub returns (bytes memory) {
        uint256 pollId = pollsCounter;

        // maximum number of members a group can contain (max size = 2 ^ merkleTreeDepth).
        // I keep it constant for now for simplicity otherwise i should
        // create a different Verifier contract for each merkleTreeDepth
        uint256 merkleTreeDepth = Constants.MERKLE_TREE_DEPTH;

        if (pollId >= 21888242871839275222246405745257275088548364400416034343698204186575808495617) {
            revert Errors.PollIdIsNotLessThanSnarkScalarField();
        }

        if (merkleTree[pollId].depth != 0) {
            revert Errors.PollAlreadyExists();
        }

        merkleTree[pollId].init(merkleTreeDepth, 0);

        Poll memory poll;
        poll.profileId = _profileId;
        poll.id = pollId;
        polls[_pubId] = poll;

        emit PollCreated(pollId, _profileId);

        unchecked {
            pollsCounter++;
        }
        return new bytes(0);
    }

    function processComment(
        uint256 _profileId,
        uint256, /*_profileIdPointed*/
        uint256 _pubIdPointed,
        bytes calldata _data
    ) external override onlyHub {
        // Only relay can vote
        if (IERC721(HUB).ownerOf(_profileId) == relay) {
            (uint256 nullifierHash, bytes32 vote, uint256[8] memory proof) = abi.decode(
                _data,
                (uint256, bytes32, uint256[8])
            );

            if (nullifierHashes[nullifierHash]) {
                revert Errors.DoubleVoting();
            }

            Poll memory poll = polls[_pubIdPointed];
            uint256 pollId = poll.id;            

            _verifyProof(vote, merkleTree[pollId].root, nullifierHash, pollId, proof);
            nullifierHashes[nullifierHash] = true;

            emit VoteAdded(pollId, vote);
        }
    }

    function processMirror(
        uint256, /*__collectorProfileId*/
        uint256, /*__profileIdPointed*/
        uint256, /*__pubIdPointed*/
        bytes calldata /*_data*/
    ) external override onlyHub {}

    function registerIdentity(uint256 _pollId, uint256 _identityCommitment) external onlyRelay {
        merkleTree[_pollId].insert(_identityCommitment);
    }

    function _verifyProof(
        bytes32 _signal,
        uint256 _root,
        uint256 _nullifierHash,
        uint256 _externalNullifier,
        uint256[8] memory _proof
    ) internal view {
        uint256 signalHash = uint256(keccak256(abi.encodePacked(_signal))) >> 8;

        verifier.verifyProof(
            [_proof[0], _proof[1]],
            [[_proof[2], _proof[3]], [_proof[4], _proof[5]]],
            [_proof[6], _proof[7]],
            [_root, _nullifierHash, signalHash, _externalNullifier]
        );
    }
}
