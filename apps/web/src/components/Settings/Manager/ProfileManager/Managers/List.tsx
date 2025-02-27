import type { ProfileManagersRequest } from '@hey/lens';
import type { FC } from 'react';
import type { Address } from 'viem';

import Loader from '@components/Shared/Loader';
import WalletProfile from '@components/Shared/WalletProfile';
import { MinusCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { LensHub } from '@hey/abis';
import { Errors } from '@hey/data';
import { LENSHUB_PROXY } from '@hey/data/constants';
import { SETTINGS } from '@hey/data/tracking';
import {
  ChangeProfileManagerActionType,
  useBroadcastOnchainMutation,
  useCreateChangeProfileManagersTypedDataMutation,
  useProfileManagersQuery
} from '@hey/lens';
import { useApolloClient } from '@hey/lens/apollo';
import checkDispatcherPermissions from '@hey/lib/checkDispatcherPermissions';
import getSignature from '@hey/lib/getSignature';
import { Button, EmptyState, ErrorMessage, Spinner } from '@hey/ui';
import errorToast from '@lib/errorToast';
import { Leafwatch } from '@lib/leafwatch';
import { useState } from 'react';
import { useInView } from 'react-cool-inview';
import toast from 'react-hot-toast';
import useHandleWrongNetwork from 'src/hooks/useHandleWrongNetwork';
import { useNonceStore } from 'src/store/non-persisted/useNonceStore';
import { useProfileRestriction } from 'src/store/non-persisted/useProfileRestriction';
import useProfileStore from 'src/store/persisted/useProfileStore';
import { useSignTypedData, useWriteContract } from 'wagmi';

const List: FC = () => {
  const currentProfile = useProfileStore((state) => state.currentProfile);
  const { isSuspended } = useProfileRestriction();
  const lensHubOnchainSigNonce = useNonceStore(
    (state) => state.lensHubOnchainSigNonce
  );
  const setLensHubOnchainSigNonce = useNonceStore(
    (state) => state.setLensHubOnchainSigNonce
  );
  const [removingAddress, setRemovingAddress] = useState<Address | null>(null);

  const handleWrongNetwork = useHandleWrongNetwork();
  const { cache } = useApolloClient();
  const { canBroadcast } = checkDispatcherPermissions(currentProfile);

  const onCompleted = (
    __typename?: 'LensProfileManagerRelayError' | 'RelayError' | 'RelaySuccess'
  ) => {
    if (
      __typename === 'RelayError' ||
      __typename === 'LensProfileManagerRelayError'
    ) {
      return;
    }

    cache.evict({ id: `ProfilesManagedResult:${removingAddress}` });
    toast.success('Manager removed successfully!');
    Leafwatch.track(SETTINGS.MANAGER.REMOVE_MANAGER);
  };

  const onError = (error: any) => {
    errorToast(error);
    setRemovingAddress(null);
  };

  const request: ProfileManagersRequest = { for: currentProfile?.id };
  const { data, error, fetchMore, loading } = useProfileManagersQuery({
    variables: { request }
  });

  const { signTypedDataAsync } = useSignTypedData({ mutation: { onError } });
  const { writeContractAsync } = useWriteContract({
    mutation: { onError, onSuccess: () => onCompleted() }
  });

  const write = async ({ args }: { args: any[] }) => {
    return await writeContractAsync({
      abi: LensHub,
      address: LENSHUB_PROXY,
      args,
      functionName: 'changeDelegatedExecutorsConfig'
    });
  };

  const [broadcastOnchain] = useBroadcastOnchainMutation({
    onCompleted: ({ broadcastOnchain }) =>
      onCompleted(broadcastOnchain.__typename)
  });
  const [createChangeProfileManagersTypedData] =
    useCreateChangeProfileManagersTypedDataMutation({
      onCompleted: async ({ createChangeProfileManagersTypedData }) => {
        const { id, typedData } = createChangeProfileManagersTypedData;
        const {
          approvals,
          configNumber,
          delegatedExecutors,
          delegatorProfileId,
          switchToGivenConfig
        } = typedData.value;
        const args = [
          delegatorProfileId,
          delegatedExecutors,
          approvals,
          configNumber,
          switchToGivenConfig
        ];
        await handleWrongNetwork();
        setLensHubOnchainSigNonce(lensHubOnchainSigNonce + 1);

        if (canBroadcast) {
          const signature = await signTypedDataAsync(getSignature(typedData));
          const { data } = await broadcastOnchain({
            variables: { request: { id, signature } }
          });
          if (data?.broadcastOnchain.__typename === 'RelayError') {
            return await write({ args });
          }

          return;
        }

        return await write({ args });
      },
      onError
    });

  const removeManager = async (address: Address) => {
    if (isSuspended) {
      return toast.error(Errors.Suspended);
    }

    try {
      setRemovingAddress(address);
      return await createChangeProfileManagersTypedData({
        variables: {
          options: { overrideSigNonce: lensHubOnchainSigNonce },
          request: {
            changeManagers: [
              { action: ChangeProfileManagerActionType.Remove, address }
            ]
          }
        }
      });
    } catch (error) {
      onError(error);
    }
  };

  const profileManagers = data?.profileManagers.items.filter(
    (item) => !item.isLensManager
  );
  const pageInfo = data?.profileManagers?.pageInfo;
  const hasMore = pageInfo?.next;

  const { observe } = useInView({
    onChange: async ({ inView }) => {
      if (!inView || !hasMore) {
        return;
      }

      return await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
    }
  });

  if (loading) {
    return (
      <div className="pb-5">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage error={error} title="Failed to load profile managers" />
    );
  }

  if (profileManagers?.length === 0) {
    return (
      <EmptyState
        hideCard
        icon={<UserCircleIcon className="text-brand-500 size-8" />}
        message="No profile managers added!"
      />
    );
  }

  return (
    <div className="space-y-4">
      {profileManagers?.map((manager) => (
        <div
          className="flex items-center justify-between"
          key={manager.address}
        >
          <WalletProfile address={manager.address} />
          <Button
            disabled={removingAddress === manager.address}
            icon={
              removingAddress === manager.address ? (
                <Spinner size="xs" />
              ) : (
                <MinusCircleIcon className="size-4" />
              )
            }
            onClick={() => removeManager(manager.address)}
            outline
          >
            Remove
          </Button>
        </div>
      ))}
      {hasMore ? <span ref={observe} /> : null}
    </div>
  );
};

export default List;
