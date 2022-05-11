import { useMemo, useState } from "react";

import { AddTransactionResponse } from "starknet";
import { EthAccount } from "eip712-starknet-account";
import useSWR from "swr";

export type TrackTxStatus = (response: AddTransactionResponse) => void;

export const trackTxInProgress = (
  lib: EthAccount,
  onEnd: () => void
): { trackTx: TrackTxStatus; txInProgress?: string } => {
  const [txInProgress, setTxInProgress] = useState("");
  useSWR(
    txInProgress && `tx-${txInProgress}`,
    async () => {
      console.log("tx in progress", txInProgress);
      const result = await lib.getTransactionStatus(txInProgress);
      console.log("tx result", result);
      console.log(result);
      const { tx_status: status } = result;
      const mapping = {
        ACCEPTED_ON_L2: "Transaction accepted on L2",
        ACCEPTED_ON_L1: "Transaction accepted on L1",
        REJECTED: "Transaction rejected",
      };
      if (mapping[status]) {
        onEnd();
        setTxInProgress("");
        alert(mapping[status]);
      }
    },
    { refreshInterval: 5000 }
  );

  return useMemo(
    () => ({
      trackTx: (response: AddTransactionResponse) =>
        setTxInProgress(response.transaction_hash),
      setTxInProgress,
    }),
    [txInProgress]
  );
};
