import 'dotenv/config';
import bodyParser from 'body-parser';
import cosmosjs from '@cosmostation/cosmosjs'
import { reset } from 'nodemon';

const chainId = process.env.CHAIN_ID;
const lcdAddress = process.env.LCD_ADDRESS;
const walletPath = process.env.HD_WALLET_PATH;
const mnemonic = process.env.MNEMONIC;
const bech32Prefix = process.env.BECH32_PREFIX;
const amount = process.env.AMOUNT;
const denom = process.env.DENOM;
const minutes = parseInt(process.env.MINUTES);
const memo = process.env.MEMO;
const tmprt = process.env.TMPRT;
const cosmos = cosmosjs.network(lcdAddress, chainId);

cosmos.setPath(walletPath);
cosmos.setBech32MainPrefix(bech32Prefix);

const address = cosmos.getAddress(mnemonic);
const ecpairPriv = cosmos.getECPairPriv(mnemonic);

const compression = require('compression');
const helmet = require('helmet');

const rpc = require('http');

const express = require('express')
const app = express()
const port = 3456

const airdropInterval = minutes*60*1000;

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)
const historyStore = db.get('history');
// db.defaults({ history: [] })
//   .write()
  
app.use(compression());
app.use(helmet());

app.set('view engine', 'pug')

const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// function to list validators on most latest block 
const getValidators =  ()=>{
    let url = lcdAddress + '/validatorsets/latest';

        try{
            let validators = rpc.get(url);
            if (validators.statusCode == 200){
                validators = JSON.parse(validators .content).validators;
                if (validators)              
                    return validators;
            };
        }
        catch (e){
            console.log(url);
            console.log(e);
        }

}

// functions to check if the requester is greedy validator 

const is_Gvalidator = (desmos_address) => {  
   
        let validators_list = getValidators();
        let url = lcdAddress + '/staking/delegators/'+desmos_address+'/validators';
        let flag_mV = false;
        try{
            let assoc_validators = rpc.get(url);
            if (assoc_validators.statusCode == 200){
                assoc_validators = JSON.parse(assoc_validators .content).result;       
                let assoc_validators_address = assoc_validators.map(assoc_validator => { return assoc_validator.operator_address; });
                let matched_validators = validators_list.filter(lv => assoc_validators_address.includes(lv.address));
                matched_validators.forEach( (mValidator,i) => {
                    matched_validators[i].voting_power = parseInt(matched_validators.voting_power);
                    if(matched_validators.voting_power > 200){ 
                        return flag_mV = true; 
                    }

                });
                return flag_mV;
            };
            console.log("Address was checked for associated greedy validator"+flag_mV);
        }
        catch (e){
            console.log(url);
            console.log(e);
        }

    }

//function to check address is greedy 
const is_Gaddress = (desmos_address) => {
    let url = lcdAddress + '/bank/balances/'+desmos_address;
    let flag_mA = false;
    try{
        let balances = rpc.get(url);
        if (balances.statusCode == 200){
            balances = JSON.parse(balances.content).result;
            balances.forEach((balance, i) => {
                if (balances[i] && balances[i].amount)
                    balances[i].amount = parseFloat(balances[i].amount);
                    if(balances[i].amount > 10000000){
                        return flag_mA = true; 
                    }    
            });
            
            return flag_mA;
        };
        console.log("Address was checked for balance"+flag_mA);
    }
    catch (e){
        console.log(url);
        console.log(e);
    }
}



app.get('/', function (req, res) {
    res.render('index', {
        chainId: chainId,
        denom: denom
    });
});

app.post('/airdrop', (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    ip = ip.split(",").map(item => item.trim());
    ip = ip[0];
    let existingIP = historyStore
        .find({ ip: ip })
        .value()
     
    if (((typeof existingIP == "undefined") || (Date.now()-existingIP.airdropTime >= airdropInterval)) && !is_Gvalidator(req.body.address) && !is_Gaddress(req.body.address)){
        
        cosmos.getAccounts(address).then(data => {
            let stdSignMsg = cosmos.NewStdMsg({
                type: "cosmos-sdk/MsgSend",
                from_address: address,
                to_address: req.body.address,
                amountDenom: denom,
                amount: amount,
                feeDenom: denom,
                fee: 0,
                gas: 200000,
                memo: memo,
                account_number: data.result.value.account_number,
                sequence: data.result.value.sequence
            });

            const signedTx = cosmos.sign(stdSignMsg, ecpairPriv);
            cosmos.broadcast(signedTx).then(response => {
                let now = Date.now();
                if (typeof existingIP !== "undefined"){
                    historyStore.find({ ip: ip })
                        .assign({airdropTime: now})
                        .write();
                }
                else{
                    historyStore
                        .push({ ip: ip, airdropTime: now})
                        .write()
                }
                res.send(response)
            });
        })
    }
    else{
        res.send({message: 'You are not ready. Please come back again tomorrow.'});
    }
})

app.listen(port, () => console.log(`Airdropping... ${port}!`))
