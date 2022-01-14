import ReactDOM from "react-dom";
import {useMemo, useState} from "react";
import {getLib, Lib, makeData} from "./lib";
import {Address, ecrecover, fromRpcSig} from "ethereumjs-util";
import {getMessage} from 'eip-712';
import {serialize} from "@ethersproject/transactions";

const padded = {display: "block", padding: 20};

const recorverAddress = (signature: string, hash: Buffer) => {
    console.log({signature});
    const sig = fromRpcSig(signature);
    console.log(sig)
    return Address.fromPublicKey(ecrecover(hash, sig.v, sig.r, sig.s));
}

const App = () => {
    const [lib, setLib] = useState<Lib>();
    const [address, setAddress] = useState("0x03606DB92E563E41F4A590BC01C243E8178E9BA8C980F8E464579F862DA3537C");
    const [selector, setSelector] = useState("1530486729947006463063166157847785599120665941190480211966374137237989315360");
    const [calldata, setCalldata] = useState("1234, 11")
    const [signature, setSignature] = useState("");

    const payload = useMemo(() => {
        try {
            return ({
                address: BigInt(address),
                selector: BigInt(selector),
                calldata: calldata.split(",").map(v => v.trim()).filter(v => v).map(BigInt),
            });
        } catch (e) {
            return undefined
        }
    }, [address, selector, calldata]);

    const hash = payload && getMessage(makeData(payload) as any, true);
    const data = payload && getMessage(makeData(payload) as any);
    const transaction = payload && signature && serialize({data}, signature);

    return <div>
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
                <input style={{display: "block"}} onChange={e => setAddress(e.target.value)} value={address}/>
            </label>
            <label style={padded}>
                Selector
                <input style={{display: "block"}} onChange={e => setSelector(e.target.value)} value={selector}/>
            </label>
            <label style={padded}>
                Calldata
                <input style={{display: "block"}} onChange={e => setCalldata(e.target.value)} value={calldata}/>
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
            DATA<br/>
            {data && <pre>{data.toString("hex")}</pre>}
            HASH<br/>
            {payload && <pre>{hash}</pre>}
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
            <button disabled={!transaction} onClick={() => lib.sendTransaction(transaction).then(console.log).catch(console.error)}>
                SEND TRANSACTION
            </button>
        </div>
    </div>;
};

const app = document.getElementById("app");
ReactDOM.render(<App/>, app);