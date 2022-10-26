module.exports.generatePrivateVote = (_vote, _secret) =>
  ethers.utils.solidityKeccak256(['uint256', 'bytes32'], [_vote.toString(), ethers.utils.formatBytes32String(_secret)])
