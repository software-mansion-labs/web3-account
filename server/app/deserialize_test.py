from server.app.deserialize import get_simple_signature


def test_signature():
    address = get_simple_signature(
        nonce=0,
        gas_price=0,
        gas_limit=0x5208,
        to=bytes.fromhex("1111111111111111111111111111111111111111"),
        value=0,
        data=bytes.fromhex(
            "a9059cbb000000000000000000000000c116f87a2e8816ac2a081f60d754d27cfa9b16a90000000000000000000000000000000000000000000000000000000000000000"
        ),
        v=58,
        r=0xAE50BB31A4A15E17773B88B4BA3B5C581DA0D14CEE91E9AC0AF7776C1DAC7C8D,
        s=0x2CD6782115DF5AA9F2806BFF990EAFE4CD99AC715E980863F8C2E8FE27D9A0A4,
    )
    assert address == "0x7FC37b5571e7128DB2CfA7714eDAA4e9Bedf0883"
