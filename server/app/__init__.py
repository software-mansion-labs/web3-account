import fastapi_jsonrpc as jsonrpc
from server.app.api import api

app = jsonrpc.API()
app.bind_entrypoint(api)
