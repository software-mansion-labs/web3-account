import {signTypedData, SignTypedDataVersion, TypedDataUtils} from "@metamask/eth-sig-util";
import {typedData} from "./typedData";
import {parseSignature} from "./utils";

console.log(
    "DOMAIN HASH:",
    "0x" + TypedDataUtils.hashStruct(
        'EIP712Domain',
        typedData.domain,
        typedData.types,
        SignTypedDataVersion.V4,
    ).toString("hex")
);
console.log(
    "CALL HASH:",
    "0x" + TypedDataUtils.hashType("Call", typedData.types).toString("hex")
)
console.log(
    "TYPE HASH:",
    "0x" + TypedDataUtils.hashType(typedData.primaryType, typedData.types).toString("hex")
)

let privateKey = "f95e53f6ba8055b25ac3c5576e818e57a84d5d68e03b73f5a441f0464f5980ae";
let address = "0x7156fb3c40b9636425931f57a87c507aa472d1b97d52859e5c68b9ba2b3570";
let selector = "0x1326ba54c1a0ca5f0593bfe36b9adeaf723e0ce0e8737bd108812706386cefb";
let testCases = [0, 1, 2].map(index => {
    const message = {
        nonce: index.toString(),
        maxFee: "0",
        version: "0",
        calls: [{
            address,
            selector,
            calldata: [index, index + 1, index + 2],
        }]
    };
    const result = index + index + 1 + index + 2;
    const data = {...typedData, message} as any;
    const signature = signTypedData({
        privateKey: Buffer.from(privateKey, 'hex'),
        data,
        version: SignTypedDataVersion.V4
    })
    return {
        message,
        result,
        signature: parseSignature(signature),
    };
});
console.log(
    "TEST CASES:",
    JSON.stringify(testCases, null, 2),
)