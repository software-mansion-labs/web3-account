import fastapi_jsonrpc as jsonrpc

api = jsonrpc.Entrypoint("/api/v1/jsonrpc")


@api.method()
def todo() -> str:
    pass
