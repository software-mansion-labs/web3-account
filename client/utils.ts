import {Signature} from "starknet";
import {fromRpcSig} from "ethereumjs-util";

const RECOVERY_OFFSET = 27;


export const parseSignature = (signature: string): Signature => {
    const {v, r, s} = fromRpcSig(signature);

    const rHigh = "0x" + r.slice(0, 16).toString("hex");
    const rLow = "0x" + r.slice(16, 32).toString("hex");

    const sHigh = "0x" + s.slice(0, 16).toString("hex");
    const sLow = "0x" + s.slice(16, 32).toString("hex");

    const vStr = "0x" + (v - RECOVERY_OFFSET).toString(16);

    return [vStr, rLow, rHigh, sLow, sHigh];
}