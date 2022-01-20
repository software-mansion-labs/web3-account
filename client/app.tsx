import ReactDOM from "react-dom";
import {useCallback, useEffect, useMemo, useState} from "react";
import {computeAddress, getLib, Lib, makeData} from "./lib";
import {Address, ecrecover, fromRpcSig, keccak} from "ethereumjs-util";
import {getMessage} from 'eip-712';
import {serialize} from "@ethersproject/transactions";
import {toBufferBE} from "bigint-buffer";
import {getSelectorFromName} from "starknet/utils/stark";
import {CallContractResponse, defaultProvider, Provider} from "starknet";
import {encode} from "rlp";

const padded = {display: "block", padding: 20};
const inputStyle = {width: "600px", display: "block"}

// const fullMessage = encode([
//             0,
//             0,
//             0x5208,
//              new Buffer("1111111111111111111111111111111111111111", "hex"),
//             0,
//             new Buffer("a9059cbb000000000000000000000000c116f87a2e8816ac2a081f60d754d27cfa9b16a90000000000000000000000000000000000000000000000000000000000000000", "hex"),
//             11,
//             0,
//             0
//         ]);
// const hashed = keccak(fullMessage);
//
// console.log({single: encode([0,0]), fullMessage: fullMessage.toString("hex"), hashed: hashed.toString("hex")})
//
// console.log("ENCODED", Address.fromPublicKey(
//     ecrecover(
//         hashed,
//         58,
//         new Buffer("ae50bb31a4a15e17773b88b4ba3b5c581da0d14cee91e9ac0af7776c1dac7c8d", "hex"),
//         new Buffer("2cd6782115df5aa9f2806bff990eafe4cd99ac715e980863f8c2e8fe27d9a0a4", "hex"),
//         11
//     )).toString()
// );

const recorverAddress = (signature: string, hash: Buffer) => {
    console.log({signature});
    const sig = fromRpcSig(signature);
    console.log(sig)
    return Address.fromPublicKey(ecrecover(hash, sig.v, sig.r, sig.s));
}

const AddressTranslator = () => {
    const [address, setAddress] = useState("0xc116F87a2e8816Ac2A081f60D754d27CfA9b16a9");
    const transformed = useMemo(() => {
        if (!address) {
            return "";
        }
        try {
            return computeAddress(address);
        } catch {
            return "";
        }
    }, [address]);
    return (<div style={padded}>
        <p>

            GET STARKNET ADDRESS
            <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)}/>
        </p>
        <p>

            STARKWARE ADDDRESS = {transformed}
        </p>
        --------------------------------------
    </div>)
}


const App = () => {
    const [lib, setLib] = useState<Lib>();
    const [address, setAddress] = useState("396161077959321855490201456901350256251627335322770279210021764778476269939");
    const [selector, setSelector] = useState("232670485425082704932579856502088130646006032362877466777181098476241604910");
    const [calldata, setCalldata] = useState("0x1d68d5dd4c8df4dda6b22e3037f44ba083870ef5a5d1d076b267261f21671d8, 1, 0");
    const [nonce, setNonce] = useState("0");
    const [signature, setSignature] = useState("");

    const updateNonce = useCallback(() => {
        if (lib) {
            lib.fetchNonce().then(v => setNonce(v.toString()))
        }
    }, [lib]);

    useEffect(() => {
        updateNonce();
    }, [updateNonce]);

    const payload = useMemo(() => {
        try {
            return ({
                nonce: BigInt(nonce),
                address: BigInt(address),
                selector: BigInt(selector),
                calldata: calldata.split(",").map(v => v.trim()).filter(v => v).map(BigInt),
            });
        } catch (e) {
            return undefined
        }
    }, [address, selector, calldata, nonce]);

    useEffect(() => {
        setSignature("");
    }, [payload])

    const hash = payload && getMessage(makeData(payload) as any, true);
    const transactionData = payload && Buffer.concat([
        toBufferBE(payload.address, 32),
        toBufferBE(payload.selector, 32),
        ...payload.calldata.map(v => toBufferBE(v, 32)),
    ]);
    const transaction = payload && signature && nonce !== undefined && serialize({
        data: transactionData,
        nonce: parseInt(nonce)
    }, signature);

    return <div>
        <AddressTranslator/>
        <div style={padded}>
            <button disabled={!!lib} onClick={async () => {
                const lib = await getLib();
                await lib.useStarknet()
                await lib.connectAccounts();
                setLib(lib);
            }}>
                CONNECT TO METAMASK
            </button>
        </div>
        <div style={padded}>
            <label style={padded}>
                Address
                <input style={inputStyle} onChange={e => setAddress(e.target.value)} value={address}/>
            </label>
            <label style={padded}>
                Selector
                <input style={inputStyle} onChange={e => setSelector(e.target.value)} value={selector}/>
            </label>
            <label style={padded}>
                Calldata
                <input style={inputStyle} onChange={e => setCalldata(e.target.value)} value={calldata}/>
            </label>
            <label style={padded}>
                Nonce
                <input style={inputStyle} value={nonce === undefined ? "loading..." : nonce} disabled/>
            </label>
        </div>
        <div style={padded}>
            {payload && <pre>PAYLOAD {JSON.stringify({
                address: payload.address.toString(),
                selector: payload.selector.toString(),
                calldata: payload.calldata.toString(),
            }, null, 2)}</pre>}
        </div>
        <div style={padded}>
            {nonce !== undefined && <>NONCE:<br/>
                <pre>{nonce}</pre>
            </>}
        </div>
        <div style={padded}>
            DATA<br/>
            {transactionData && <pre>{transactionData.toString("hex")}</pre>}
        </div>
        <div style={padded}>
            EIP712 DATA<br/>
            {payload && <pre>{getMessage(makeData(payload) as any).toString("hex")}</pre>}
        </div>
        <div style={padded}>
            EIP712 DATA HASH<br/>
            {payload && <pre>{hash.toString("hex")}</pre>}
        </div>
        <div style={padded}>
            <button disabled={!lib || !payload} onClick={() => lib.sign(payload).then(setSignature)}>
                GENERATE SIGNATURE
            </button>
        </div>
        <div style={padded}>
            SIGNATURE<br/>
            {signature && <pre>{signature}</pre>}
            RECOVERED ADDRESS<br/>
            {hash && signature && <pre>{recorverAddress(signature, hash).toString()}</pre>}
            TRANSACTION<br/>
            {transaction && <pre>{transaction}</pre>}
        </div>
        <div style={padded}>
            <button disabled={!transaction}
                    onClick={() => lib.sendTransaction(transaction).then(console.log).then(() => alert("SUCCESS!")).then(() => updateNonce()).catch(console.error)}>
                SEND TRANSACTION
            </button>
        </div>
    </div>;
};

const app = document.getElementById("app");
ReactDOM.render(<App/>, app);