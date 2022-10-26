require('dotenv').config()
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-etherscan')
require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')

const getEnvironmentVariable = (_envVar) => process.env[_envVar]

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.10',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: `${getEnvironmentVariable('POLYGON_MAINNET_NODE')}`,
      },
    },
    /*polygon: {
      url: getEnvironmentVariable('POLYGON_MAINNET_NODE'),
      accounts: [getEnvironmentVariable('POLYGON_MAINNET_PRIVATE_KEY')],
      gasPrice: 7e9,
      gas: 200e9,
    },*/
  },
  etherscan: {
    apiKey: getEnvironmentVariable('ETHERSCAN_API_KEY'),
  },
  gasReporter: {
    enabled: true,
  },
  mocha: {
    timeout: 200000,
  },
}
