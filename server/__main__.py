import uvicorn


if __name__ == "__main__":
    uvicorn.run("server:app", port=7001, debug=True, access_log=False)
