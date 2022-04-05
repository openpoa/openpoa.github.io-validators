import Web3 from 'web3'
import helpers from './helpers'
import { constants } from './constants'
import messages from './messages'

const defaultNetId = helpers.netIdByBranch(constants.branches.CORE)

async function getAccounts(web3) {
  let accounts
  if (window.ethereum) {
    accounts = await window.ethereum.request({ method: 'eth_accounts' })
  } else {
    accounts = await web3.eth.getAccounts()
  }
  return accounts
}

async function getNetId(web3) {
  let netId
  if (window.ethereum) {
    const { chainId } = window.ethereum
    netId = web3.utils.isHex(chainId) ? web3.utils.hexToNumber(chainId) : chainId
  } else {
    netId = await web3.eth.net.getId()
  }
  return netId
}

export async function enableWallet(onAccountChange) {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
    } catch (e) {
      await onAccountChange(null)
      throw Error(messages.userDeniedAccessToAccount)
    }

    const web3 = new Web3(window.ethereum)
    const accounts = await getAccounts(web3)

    await onAccountChange(accounts[0])
  }
}

export default async function getWeb3(netId, onAccountChange) {
  let web3 = null

  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (window.ethereum) {
    web3 = new Web3(window.ethereum)
    console.log('Injected web3 detected.')
    if (!window.ethereum.autoRefreshOnNetworkChange) {
      window.ethereum.on('chainChanged', () => {
        window.location.reload()
      })
    }
  } else if (window.web3) {
    web3 = new Web3(window.web3.currentProvider)
    console.log('Injected web3 detected.')
  }

  if (!netId) {
    // Load for the first time in the current browser's session
    if (web3) {
      // MetaMask (or another plugin) is injected
      netId = await getNetId(web3)
      if (!(netId in constants.NETWORKS)) {
        // If plugin's netId is unsupported, try to use
        // the previously chosen netId
        netId = window.localStorage.netId
      }
    } else {
      // MetaMask (or another plugin) is not injected,
      // so try to use the previously chosen netId
      netId = window.localStorage.netId
    }
    if (!(netId in constants.NETWORKS)) {
      // If plugin's netId and/or previously chosen netId are not supported,
      // fallback to default netId
      netId = defaultNetId
    }
    window.localStorage.netId = netId
    window.sessionStorage.netId = netId
  }

  netId = Number(netId)

  const network = constants.NETWORKS[netId]
  let netIdName = network.NAME
  let injectedWeb3 = web3 !== null
  let defaultAccount = null
  let networkMatch = false

  if (web3) {
    const accounts = await getAccounts(web3)
    defaultAccount = accounts[0] || null

    if (!defaultAccount) {
      console.log('Unlock your wallet')
    }

    let currentAccount = defaultAccount ? defaultAccount.toLowerCase() : null
    async function onUpdateAccount(account) {
      if (account && account !== currentAccount) {
        currentAccount = account
        await onAccountChange(account)
      }
    }
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async accs => {
        const account = accs && accs.length > 0 ? accs[0].toLowerCase() : null
        await onUpdateAccount(account)
      })
    } else if (web3.currentProvider.publicConfigStore) {
      web3.currentProvider.publicConfigStore.on('update', async obj => {
        const account = obj.selectedAddress ? obj.selectedAddress.toLowerCase() : null
        await onUpdateAccount(account)
      })
    }

    const web3NetId = await getNetId(web3)
    if (web3NetId === netId) {
      networkMatch = true
    } else {
      web3 = null
    }
  }

  if (!web3) {
    web3 = new Web3(new Web3.providers.HttpProvider(network.RPC))
  }

  document.title = `${netIdName} - POA Validators DApp`

  return {
    web3Instance: web3,
    netId,
    netIdName,
    injectedWeb3,
    defaultAccount,
    networkMatch
  }
}
