import { CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { EthAccountProvider, computeAddress, getAdapter } from "./lib";
import {
  FormEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { bnToUint256, uint256ToBN } from "starknet/utils/uint256";
import { hexToDecimalString, toBN } from "starknet/utils/number";

import { BN } from "ethereumjs-util";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import LoadingButton from "@mui/lab/LoadingButton";
import ReactDOM from "react-dom";
import Skeleton from "@mui/material/Skeleton";
import { trackTxInProgress } from "./hooks";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { getSelectorFromName } from "starknet/utils/hash";

const erc20Address =
  "0x5daf1a16e49474cadb53664d56df1ab6314116da7d02baef7925f8ddf567643";

// Token has 18 decimal places
const decimalShift = new BN(10).pow(new BN(18));

const TokenWallet: React.FC<{ lib: EthAccountProvider }> = ({ lib }) => {
  const { data: balance, mutate: revalidateBalance } = useSWR(
    lib.address && "balance",
    async () => {
      const { result } = await lib.callContract({
        calldata: [hexToDecimalString(computeAddress(lib.address))],
        contractAddress: erc20Address,
        entrypoint: "balanceOf",
      });
      const [low, high] = result;
      // We have 18 decimal places
      return uint256ToBN({ low, high }).div(decimalShift);
    }
  );

  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const { trackTx, txInProgress } = trackTxInProgress(lib, () =>
    revalidateBalance()
  );

  const calldata = useMemo(() => {
    if (!amount || !address || address.length != 42) {
      return undefined;
    }

    try {
      const parsedAmount = bnToUint256(toBN(amount, 10).mul(decimalShift));
      const starknetAddress = computeAddress(address);
      return [
        starknetAddress,
        parsedAmount.low.toString(16),
        parsedAmount.high.toString(16),
      ];
    } catch (e) {
      console.error(e);
    }
    return undefined;
  }, [amount, address]);

  const transferTokens: FormEventHandler = (e) => {
    e.preventDefault();

    if (loading || !calldata || !lib) {
      return;
    }

    setLoading(true);

    lib
      .invokeFunction({
        contractAddress: erc20Address,
        entrypoint: getSelectorFromName("transfer"),
        calldata,
      })
      .then(trackTx)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap={2}>
      <Typography variant="h3">Token wallet</Typography>
      <Typography>
        Your balance:{" "}
        {balance ? (
          balance.toString()
        ) : (
          <Skeleton style={{ display: "inline-block", width: 100 }} />
        )}
      </Typography>
      <Stack gap={2} component="form" onSubmit={transferTokens}>
        <Typography variant="h6">Transfer</Typography>
        <TextField
          label="Target address"
          variant="outlined"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <TextField
          label="Amount"
          variant="outlined"
          value={amount}
          inputProps={{ inputMode: "numeric", min: 0, pattern: "[0-9]*" }}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <LoadingButton
          type="submit"
          loading={loading || !!txInProgress}
          disabled={!balance || !calldata}
          variant="contained"
        >
          Send tokens
        </LoadingButton>
      </Stack>
    </Stack>
  );
};

const CreateAccountForm: React.FC<{
  lib: EthAccountProvider;
  onCreate: () => void;
}> = ({ lib, onCreate }) => {
  const [loading, setLoading] = useState(false);
  const { trackTx, txInProgress } = trackTxInProgress(lib, onCreate);
  const createAccount: FormEventHandler = (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);

    lib
      .deployAccount()
      .then((tx) => trackTx(tx))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap={1} component="form" onSubmit={createAccount}>
      <Typography variant="h6">
        It seems that you haven't created an account on StarkNet yet.
      </Typography>
      <Typography>
        In order to send any transactions you need to create an account first.
        We'll also ask you to add our adapter to MetaMask if it doesn't exist
        there.
      </Typography>
      <LoadingButton
        loading={!!txInProgress || loading}
        type="submit"
        variant="contained"
      >
        Create my account
      </LoadingButton>
    </Stack>
  );
};

const App = () => {
  const [requestedAccount, setRequestedAccount] =
    useState<EthAccountProvider>();
  const { data } = useSWRImmutable("adapter", async () => {
    const adapter = await getAdapter();
    const accounts = await adapter.getAccounts();
    const account = accounts?.[0];
    return { adapter, account };
  });
  const loadingAdapter = !data;
  const { adapter, account } = data ?? {};
  const lib = account || requestedAccount;

  const [isDeployed, setIsDeployed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!lib) {
      return;
    }

    lib.isAccountDeployed().then(setIsDeployed).catch(console.error);
  }, [lib]);

  const requestAccount = useCallback(async () => {
    const accounts = await adapter.requestAccounts();
    if (accounts && accounts[0]) {
      setRequestedAccount(accounts[0]);
    } else {
      alert("You don't have an account, please create it first");
    }
  }, [adapter]);

  if (loadingAdapter || (lib && isDeployed === undefined)) {
    return (
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ minHeight: "100vh" }}
      >
        <CircularProgress />
      </Grid>
    );
  }

  if (!lib) {
    return (
      <Dialog open={true}>
        <DialogTitle id="alert-dialog-title">Connect to Metamask</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You need to connect to Metamask in order to use this application.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={requestAccount} autoFocus>
            Connect
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return isDeployed ? (
    <TokenWallet lib={lib} />
  ) : (
    <CreateAccountForm lib={lib} onCreate={() => setIsDeployed(true)} />
  );
};

const app = document.getElementById("app");
ReactDOM.render(<App />, app);
