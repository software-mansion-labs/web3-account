import {EthAccountProvider} from "./lib";
import {AddTransactionResponse} from "starknet";
import {useMemo, useState} from "react";
import useSWR from "swr";

export type TrackTxStatus = (response: AddTransactionResponse) => void;

export const trackTxInProgress = (lib: EthAccountProvider, onEnd: () => void): {trackTx: TrackTxStatus, txInProgress?: string} => {
    const [txInProgress, setTxInProgress] = useState("");
    useSWR(txInProgress && `tx-${txInProgress}`, async () => {
        const {tx_status: status} = await lib.getTransactionStatus(txInProgress);
        const mapping = {
            ACCEPTED_ON_L2: "Transaction accepted on L2",
            ACCEPTED_ON_L1: "Transaction accepted on L1",
            REJECTED: "Transaction rejected",
        };
        if (mapping[status]) {
            onEnd();
            setTxInProgress("");
            alert(mapping[status])
        }
    }, {refreshInterval: 5000});

    return useMemo(() => ({
        trackTx: (response: AddTransactionResponse) => setTxInProgress(response.transaction_hash),
        setTxInProgress,
    }), [txInProgress]);
}