import ReactDOM from "react-dom";
import {useCallback, useEffect, useMemo, useState} from "react";
import {computeAddress, EthAccountProvider, getAdapter, makeData} from "./lib";
import {getMessage} from 'eip-712';
import {toBN} from "starknet/utils/number";

const padded = {display: "block", padding: 20};
const inputStyle = {width: "600px", display: "block"}

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
    const [lib, setLib] = useState<EthAccountProvider>();
    const [address, setAddress] = useState("3211424234384337579621930265911214626255547261850627876716653849037074533652");
    const [selector, setSelector] = useState("232670485425082704932579856502088130646006032362877466777181098476241604910");
    const [calldata, setCalldata] = useState("0x1d68d5dd4c8df4dda6b22e3037f44ba083870ef5a5d1d076b267261f21671d8, 1, 0");
    const [nonce, setNonce] = useState("0");

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
                nonce: toBN(nonce),
                address: toBN(address),
                selector: toBN(selector),
                calldata: calldata.split(",").map(v => v.trim()).filter(v => v).map(v => toBN(v)),
            });
        } catch (e) {
            return undefined
        }
    }, [address, selector, calldata, nonce]);

    const hash = payload && getMessage(makeData(payload) as any, true);
    return <div>
        <AddressTranslator/>
        <div style={padded}>
            <button disabled={!!lib} onClick={async () => {
                const adapter = await getAdapter();
                const accounts = await adapter.getAccounts();
                if (accounts && accounts[0]) {
                    setLib(accounts[0])
                }
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
            EIP712 DATA<br/>
            {payload && <pre>{getMessage(makeData(payload) as any).toString("hex")}</pre>}
        </div>
        <div style={padded}>
            EIP712 DATA HASH<br/>
            {payload && <pre>{hash.toString("hex")}</pre>}
        </div>
        <div style={padded}>
            <button disabled={!lib || !payload}
                    onClick={() => lib.addTransaction({
                        type: "INVOKE_FUNCTION",
                        nonce: payload.nonce,
                        contract_address: payload.address,
                        entry_point_selector: payload.selector,
                        calldata: payload.calldata
                    }).then(console.log).then(() => alert("SUCCESS!")).then(() => updateNonce()).catch(console.error)}>
                SEND TRANSACTION
            </button>
        </div>
    </div>;
};

const app = document.getElementById("app");
ReactDOM.render(<App/>, app);