import { ChainId } from '@aave/contract-helpers';
import { SafeAppConnector } from '@gnosis.pm/safe-apps-web3-react';
import { AbstractConnector } from '@web3-react/abstract-connector';
import { UnsupportedChainIdError } from '@web3-react/core';
import { FrameConnector } from '@web3-react/frame-connector';
import { InjectedConnector } from '@web3-react/injected-connector';
import { TorusConnector } from '@web3-react/torus-connector';
import { ConnectorUpdate } from '@web3-react/types';
import { WalletConnectConnector } from '@web3-react/walletconnect-connector';
import { WalletLinkConnector } from '@web3-react/walletlink-connector';
import { getNetworkConfig, getSupportedChainIds } from 'src/utils/marketsAndNetworksConfig';
import { LedgerHQFrameConnector } from 'web3-ledgerhq-frame-connector';

export enum WalletType {
  INJECTED = 'injected',
  WALLET_CONNECT = 'wallet_connect',
  WALLET_LINK = 'wallet_link',
  TORUS = 'torus',
  FRAME = 'frame',
  GNOSIS = 'gnosis',
  LEDGER = 'ledger',
  COIN98 = 'coin98',
  WATCH_MODE_ONLY = 'watch_mode_only',
}

const APP_NAME = 'Aave';
const APP_LOGO_URL = 'https://aave.com/favicon.ico';

const mockProvider = {
  request: Promise.resolve(null),
};

/**
 *  This is a connector to be used in watch mode only.
 *  On activate, the connector expects a local storage item called `watchModeOnlyAddress` to be set, otherwise an error is thrown.
 *  When the connector is deactivated (i.e. on disconnect, switching wallets), the local storage item is removed.
 */
export class WatchModeOnlyConnector extends AbstractConnector {
  watchAddress = '';

  activate(): Promise<ConnectorUpdate<string | number>> {
    const address = localStorage.getItem('watchModeOnlyAddress');
    if (!address || address === 'undefined') {
      throw new Error('No address found in local storage for watch mode');
    }

    this.watchAddress = address;

    return Promise.resolve({
      provider: mockProvider,
      chainId: ChainId.mainnet,
      account: this.watchAddress,
    });
  }
  getProvider(): Promise<unknown> {
    return Promise.resolve(mockProvider);
  }
  getChainId(): Promise<string | number> {
    return Promise.resolve(ChainId.mainnet);
  }
  getAccount(): Promise<string | null> {
    return Promise.resolve(this.watchAddress);
  }
  deactivate(): void {
    const storedWatchAddress = localStorage.getItem('watchModeOnlyAddress');
    if (storedWatchAddress === this.watchAddress) {
      // Only update local storage if the address is the same as the one this connector stored.
      // This will be different if the user switches to another account to watch because
      // the new connector gets iniatialzed before this one is deactivated.
      localStorage.removeItem('watchModeOnlyAddress');
    }
  }
}

export const getWallet = (
  wallet: WalletType,
  chainId: ChainId = ChainId.mainnet
): AbstractConnector => {
  const supportedChainIds = getSupportedChainIds();

  switch (wallet) {
    case WalletType.WATCH_MODE_ONLY:
      return new WatchModeOnlyConnector();
    case WalletType.LEDGER:
      return new LedgerHQFrameConnector({});
    case WalletType.INJECTED:
      return new InjectedConnector({});
    case WalletType.COIN98:
      return new InjectedConnector({});
    case WalletType.WALLET_LINK:
      const networkConfig = getNetworkConfig(chainId);
      return new WalletLinkConnector({
        appName: APP_NAME,
        appLogoUrl: APP_LOGO_URL,
        url: networkConfig.privateJsonRPCUrl || networkConfig.publicJsonRPCUrl[0],
      });
    case WalletType.WALLET_CONNECT:
      return new WalletConnectConnector({
        rpc: supportedChainIds.reduce((acc, network) => {
          const config = getNetworkConfig(network);
          acc[network] = config.privateJsonRPCUrl || config.publicJsonRPCUrl[0];
          return acc;
        }, {} as { [networkId: number]: string }),
        bridge: 'https://aave.bridge.walletconnect.org',
        qrcode: true,
      });
    case WalletType.GNOSIS:
      if (window) {
        return new SafeAppConnector();
      }
      throw new Error('Safe app not working');
    case WalletType.TORUS:
      return new TorusConnector({
        chainId,
        initOptions: {
          network: {
            host: chainId === ChainId.polygon ? 'matic' : chainId,
          },
          showTorusButton: false,
          enableLogging: false,
          enabledVerifiers: false,
        },
      });
    case WalletType.FRAME: {
      if (chainId !== ChainId.mainnet) {
        throw new UnsupportedChainIdError(chainId, [1]);
      }
      return new FrameConnector({ supportedChainIds: [1] });
    }
    default: {
      throw new Error(`unsupported wallet`);
    }
  }
};
