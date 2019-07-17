import 'dotenv/config';
import bodyParser from 'body-parser';
import cosmosjs from '@cosmostation/cosmosjs'

const chainId = process.env.CHAIN_ID;
const lcdAddress = process.env.LCD_ADDRESS;
const walletPath = process.env.HD_WALLET_PATH;
const mnemonic = process.env.MNEMONIC;
const bech32Prefix = process.env.BECH32_PREFIX;
const denom = process.env.DENOM;
const cosmos = cosmosjs.network(lcdAddress, chainId);

cosmos.setPath(walletPath);
cosmos.setBech32MainPrefix(bech32Prefix);

const address = cosmos.getAddress(mnemonic);
const ecpairPriv = cosmos.getECPairPriv(mnemonic);

const express = require('express')
const app = express()
const port = 3000

app.use(bodyParser.json());

app.post('/airdrop', (req, res) => {
    cosmos.getAccounts(address).then(data => {
        let stdSignMsg = cosmos.NewStdMsg({
            type: "cosmos-sdk/MsgSend",
            from_address: address,
            to_address: req.body.address,
            amountDenom: denom,
            amount: 1,
            feeDenom: denom,
            fee: 0,
            gas: 200000,
            memo: "Desmo Faucet",
            account_number: data.value.account_number,
            sequence: data.value.sequence
        });

        const signedTx = cosmos.sign(stdSignMsg, ecpairPriv);
        cosmos.broadcast(signedTx).then(response => {
            res.send(response)
        });
    })
})

app.listen(port, () => console.log(`Airdropping... ${port}!`))