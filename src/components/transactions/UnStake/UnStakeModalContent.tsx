import { normalize, valueToBigNumber } from '@aave/math-utils';
import { Trans } from '@lingui/macro';
import { Typography } from '@mui/material';
import { parseUnits } from 'ethers/lib/utils';
import React, { useRef, useState } from 'react';
import { useStakeData } from 'src/hooks/stake-data-provider/StakeDataProvider';
import { useModalContext } from 'src/hooks/useModal';
import { useProtocolDataContext } from 'src/hooks/useProtocolDataContext';
import { useWeb3Context } from 'src/libs/hooks/useWeb3Context';
import { stakeConfig } from 'src/ui-config/stakeConfig';
import { getNetworkConfig } from 'src/utils/marketsAndNetworksConfig';

import { AssetInput } from '../AssetInput';
import { TxErrorView } from '../FlowCommons/Error';
import { GasEstimationError } from '../FlowCommons/GasEstimationError';
import { TxSuccessView } from '../FlowCommons/Success';
import { TxModalTitle } from '../FlowCommons/TxModalTitle';
import { GasStation } from '../GasStation/GasStation';
import { ChangeNetworkWarning } from '../Warnings/ChangeNetworkWarning';
import { UnStakeActions } from './UnStakeActions';

export type UnStakeProps = {
  stakeAssetName: string;
  icon: string;
};

export enum ErrorType {
  NOT_ENOUGH_BALANCE,
}

type StakingType = 'aave' | 'bpt';

export const UnStakeModalContent = ({ stakeAssetName, icon }: UnStakeProps) => {
  const data = useStakeData();
  const stakeData = data.stakeGeneralResult?.stakeGeneralUIData[stakeAssetName as StakingType];
  const { chainId: connectedChainId, watchModeOnlyAddress } = useWeb3Context();
  const { gasLimit, mainTxState: txState, txError } = useModalContext();
  const { currentNetworkConfig, currentChainId } = useProtocolDataContext();

  // states
  const [_amount, setAmount] = useState('');
  const amountRef = useRef<string>();

  const walletBalance = normalize(
    data.stakeUserResult?.stakeUserUIData[stakeAssetName as StakingType].stakeTokenUserBalance ||
      '0',
    18
  );

  const isMaxSelected = _amount === '-1';
  const amount = isMaxSelected ? walletBalance : _amount;

  const handleChange = (value: string) => {
    const maxSelected = value === '-1';
    amountRef.current = maxSelected ? walletBalance : value;
    setAmount(value);
  };

  // staking token usd value
  const amountInUsd =
    Number(amount) *
    (Number(normalize(stakeData?.stakeTokenPriceEth || 1, 18)) /
      Number(normalize(data.stakeGeneralResult?.stakeGeneralUIData.usdPriceEth || 1, 18)));

  // error handler
  let blockingError: ErrorType | undefined = undefined;
  if (valueToBigNumber(amount).gt(walletBalance)) {
    blockingError = ErrorType.NOT_ENOUGH_BALANCE;
  }

  const handleBlocked = () => {
    switch (blockingError) {
      case ErrorType.NOT_ENOUGH_BALANCE:
        return <Trans>Not enough staked balance</Trans>;
      default:
        return null;
    }
  };

  // is Network mismatched
  const stakingChain =
    currentNetworkConfig.isFork && currentNetworkConfig.underlyingChainId === stakeConfig.chainId
      ? currentChainId
      : stakeConfig.chainId;
  const isWrongNetwork = connectedChainId !== stakingChain;

  const networkConfig = getNetworkConfig(stakingChain);

  if (txError && txError.blocking) {
    return <TxErrorView txError={txError} />;
  }
  if (txState.success)
    return (
      <TxSuccessView action={<Trans>Unstaked</Trans>} amount={amountRef.current} symbol={icon} />
    );

  return (
    <>
      <TxModalTitle title="Unstake" symbol={icon} />
      {isWrongNetwork && !watchModeOnlyAddress && (
        <ChangeNetworkWarning networkName={networkConfig.name} chainId={stakingChain} />
      )}
      <AssetInput
        value={amount}
        onChange={handleChange}
        usdValue={amountInUsd.toString()}
        symbol={icon}
        assets={[
          {
            balance: walletBalance,
            symbol: icon,
          },
        ]}
        isMaxSelected={isMaxSelected}
        maxValue={walletBalance}
      />
      {blockingError !== undefined && (
        <Typography variant="helperText" color="red">
          {handleBlocked()}
        </Typography>
      )}
      <GasStation gasLimit={parseUnits(gasLimit || '0', 'wei')} />

      {txError && <GasEstimationError txError={txError} />}

      <UnStakeActions
        sx={{ mt: '48px' }}
        amountToUnStake={amount}
        isWrongNetwork={isWrongNetwork}
        symbol={icon}
        blocked={blockingError !== undefined}
        selectedToken={stakeAssetName}
      />
    </>
  );
};
