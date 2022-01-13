import ReactDOM from "react-dom";
import {useEffect} from "react";
import {getLib} from "./lib";

const App = () => {
    useEffect(() => {
        getLib().then(l => l.suggestChain())
    }, [])
    return <div>

    </div>;
};

const app = document.getElementById("app");
ReactDOM.render(<App />, app);