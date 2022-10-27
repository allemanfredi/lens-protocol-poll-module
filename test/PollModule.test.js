const { use, expect } = require('chai')
const { ethers } = require('hardhat')
const { solidity } = require('ethereum-waffle')
const { Identity } = require('@semaphore-protocol/identity')
const { Group } = require('@semaphore-protocol/group')
const {
  generateProof,
  packToSolidityProof
} = require('@semaphore-protocol/proof')

use(solidity)

let pollModule, lensHub, creator, user1, relay, governance, creatorProfileId, relayProfileId, freeCollectModule

const LENS_HUB_ADDRESS = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d'
const INTERACTION_LOGIC_ADDRESS = '0xb05BAe098D2b0E3048DE27F1931E50b0200a043B'
const PROFILE_TOKEN_URI_LOGIC_ADDRESS = '0x3FA902A571E941dCAc6081d57917994DDB0F9A9d'
const PUBLISHING_LOGIC_ADDRESS = '0x7f9bfF8493F821111741b93429A6A6F79DC546F0'
const MOCK_URI = 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const GOVERNANCE_ADDRESS = '0xf94b90bbeee30996019babd12cecddccf68331de'
const MOCK_PROFILE_HANDLE_CREATOR = 'plant1ghost.eth'
const MOCK_PROFILE_HANDLE_RELAY = 'relaypoll.eth'
const MOCK_PROFILE_URI = 'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu'
const MOCK_FOLLOW_NFT_URI = 'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan'

const WASM_FILE_PATH = './circuits/semaphore_js/semaphore.wasm'
const ZKEY_FILE_PATH = './circuits/semaphore_0001.zkey'

describe('PollModule', () => {
  before(async () => {
    const PoseidonT3 = await ethers.getContractFactory('PoseidonT3')
    const poseidonT3 = await PoseidonT3.deploy()
    const IncrementalBinaryTree = await ethers.getContractFactory('IncrementalBinaryTree', {
      libraries: {
        PoseidonT3: poseidonT3.address,
      },
    })
    const incrementalBinaryTree = await IncrementalBinaryTree.deploy()

    const PollModule = await ethers.getContractFactory('PollModule', {
      libraries: {
        IncrementalBinaryTree: incrementalBinaryTree.address,
      },
    })
    const Verifier = await ethers.getContractFactory('Verifier')
    const LensHub = await ethers.getContractFactory('LensHub', {
      libraries: {
        InteractionLogic: INTERACTION_LOGIC_ADDRESS,
        ProfileTokenURILogic: PROFILE_TOKEN_URI_LOGIC_ADDRESS,
        PublishingLogic: PUBLISHING_LOGIC_ADDRESS,
      },
    })
    const FreeCollectModule = await ethers.getContractFactory('FreeCollectModule')

    const signers = await ethers.getSigners()
    creator = signers[0]
    relay = signers[1]
    user1 = signers[2]

    const verifier = await Verifier.deploy()
    pollModule = await PollModule.deploy(LENS_HUB_ADDRESS, verifier.address, relay.address)
    lensHub = await LensHub.attach(LENS_HUB_ADDRESS)
    freeCollectModule = await FreeCollectModule.deploy(LENS_HUB_ADDRESS)
    governance = await ethers.getImpersonatedSigner(GOVERNANCE_ADDRESS)
    zero = await ethers.getImpersonatedSigner(ZERO_ADDRESS)

    await zero.sendTransaction({
      to: governance.address,
      value: ethers.utils.parseEther('15'),
    })
    await zero.sendTransaction({
      to: user1.address,
      value: ethers.utils.parseEther('15'),
    })

    await lensHub.connect(governance).whitelistReferenceModule(pollModule.address, true)
    await lensHub.connect(governance).whitelistCollectModule(freeCollectModule.address, true)
    await lensHub.connect(governance).whitelistProfileCreator(creator.address, true)
    await lensHub.connect(governance).whitelistProfileCreator(relay.address, true)

    await lensHub.connect(creator).createProfile({
      to: creator.address,
      handle: MOCK_PROFILE_HANDLE_CREATOR,
      imageURI: MOCK_PROFILE_URI,
      followModule: ZERO_ADDRESS,
      followModuleInitData: [],
      followNFTURI: MOCK_FOLLOW_NFT_URI,
    })
    await lensHub.connect(relay).createProfile({
      to: relay.address,
      handle: MOCK_PROFILE_HANDLE_RELAY,
      imageURI: MOCK_PROFILE_URI,
      followModule: ZERO_ADDRESS,
      followModuleInitData: [],
      followNFTURI: MOCK_FOLLOW_NFT_URI,
    })

    creatorProfileId = await lensHub.getProfileIdByHandle(MOCK_PROFILE_HANDLE_CREATOR)
    relayProfileId = await lensHub.getProfileIdByHandle(MOCK_PROFILE_HANDLE_RELAY)
  })

  it('should be able to vote by commenting a post', async () => {
    const signedMessage = await user1.signMessage('message')
    const identity = new Identity(signedMessage.toString())
    const pollId = 1
    const vote = ethers.utils.formatBytes32String(1) // in case there will be a reveal phase this could be the commitment -> generatePrivateVote(1, 'hash(messageSignedWithWallet)')

    const group = new Group(20)
    group.addMembers([identity.generateCommitment()])

    const fullProof = await generateProof(identity, group, pollId, vote, {
      wasmFilePath: WASM_FILE_PATH,
      zkeyFilePath: ZKEY_FILE_PATH,
    })

    const publicSignals = fullProof.publicSignals
    const solidityProof = packToSolidityProof(fullProof.proof)

    await expect(
      lensHub.connect(creator).post({
        profileId: creatorProfileId,
        contentURI: MOCK_URI,
        collectModule: freeCollectModule.address,
        collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
        referenceModule: pollModule.address,
        referenceModuleInitData: '0x',
      })
    )
      .to.emit(pollModule, 'PollCreated')
      .withArgs(pollId, creatorProfileId)

    await pollModule.connect(relay).registerIdentity(pollId, identity.generateCommitment())

    // relay should check that user1 owns a Lens Protocol profile
    await expect(
      lensHub.connect(relay).comment({
        profileId: relayProfileId,
        contentURI: MOCK_URI,
        profileIdPointed: creatorProfileId,
        pubIdPointed: 1,
        referenceModuleData: ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'bytes32', 'uint256[8]'],
          [publicSignals.nullifierHash, vote, solidityProof]
        ),
        collectModule: freeCollectModule.address,
        collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
        referenceModule: ZERO_ADDRESS,
        referenceModuleInitData: [],
      })
    )
      .to.emit(pollModule, 'VoteAdded')
      .withArgs(pollId, vote)
  })

  it('should not be able to double vote', async () => {
    const signedMessage = await user1.signMessage('message')
    const identity = new Identity(signedMessage)
    const pollId = 2
    const vote = ethers.utils.formatBytes32String(1)

    const group = new Group(20)
    group.addMembers([identity.generateCommitment()])

    const fullProof = await generateProof(identity, group, pollId, vote, {
      wasmFilePath: WASM_FILE_PATH,
      zkeyFilePath: ZKEY_FILE_PATH,
    })

    const publicSignals = fullProof.publicSignals
    const solidityProof = packToSolidityProof(fullProof.proof)

    await lensHub.connect(creator).post({
      profileId: creatorProfileId,
      contentURI: MOCK_URI,
      collectModule: freeCollectModule.address,
      collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
      referenceModule: pollModule.address,
      referenceModuleInitData: '0x',
    })

    await pollModule.connect(relay).registerIdentity(pollId, identity.generateCommitment())

    await lensHub.connect(relay).comment({
      profileId: relayProfileId,
      contentURI: MOCK_URI,
      profileIdPointed: creatorProfileId,
      pubIdPointed: 2,
      referenceModuleData: ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'bytes32', 'uint256[8]'],
        [publicSignals.nullifierHash, vote, solidityProof]
      ),
      collectModule: freeCollectModule.address,
      collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
      referenceModule: ZERO_ADDRESS,
      referenceModuleInitData: [],
    })

    await expect(
      lensHub.connect(relay).comment({
        profileId: relayProfileId,
        contentURI: MOCK_URI,
        profileIdPointed: creatorProfileId,
        pubIdPointed: 2,
        referenceModuleData: ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'bytes32', 'uint256[8]'],
          [publicSignals.nullifierHash, vote, solidityProof]
        ),
        collectModule: freeCollectModule.address,
        collectModuleInitData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
        referenceModule: ZERO_ADDRESS,
        referenceModuleInitData: [],
      })
    ).to.be.revertedWith('DoubleVoting()')
  })
})
