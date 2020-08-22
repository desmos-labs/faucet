import 'dotenv/config';
import bodyParser from 'body-parser';
import cosmosjs from '@cosmostation/cosmosjs'
import { reset } from 'nodemon';
import { Console } from 'console';

const chainId = process.env.CHAIN_ID;
const lcdAddress = process.env.LCD_ADDRESS;
const walletPath = process.env.HD_WALLET_PATH;
const mnemonic = process.env.MNEMONIC;
const bech32Prefix = process.env.BECH32_PREFIX;
const amount = process.env.AMOUNT;
const denom = process.env.DENOM;
const minutes = parseInt(process.env.MINUTES);
const memo = process.env.MEMO;
const lcdhost = process.env.LCD_HOST;
const lcdport = process.env.LCD_PORT;
const cosmos = cosmosjs.network(lcdAddress, chainId);

cosmos.setPath(walletPath);
cosmos.setBech32MainPrefix(bech32Prefix);

const address = cosmos.getAddress(mnemonic);
const ecpairPriv = cosmos.getECPairPriv(mnemonic);

const compression = require('compression');
const helmet = require('helmet');

//const rpc = require('http');
var axios = require('axios');

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
    let flag_mV = false;
    let flag_mA = false;
    let desmos_address = req.body.address;
    let url1 = lcdAddress+"/validatorsets/latest"
    let url2= lcdAddress+'/staking/delegators/'+desmos_address+'/validators'
    let url3 = lcdAddress + '/bank/balances/'+desmos_address;
    axios.all([
        axios.get(url1),
        axios.get(url2), 
        axios.get(url3),
    ]).then(axios.spread((response1, response2, response3) => {
        let validators_list = response1.data.result.validators;
        let assoc_validators = response2.data.result; 
                        console.log("checking associated validator to the delegator address....")
                        console.log(assoc_validators)      
                        let assoc_validators_address = assoc_validators.map(assoc_validator => { return assoc_validator.operator_address; });
                        console.log("Cross-linked Validators:....")
                        console.log(assoc_validators_address)
                        let matched_validators = validators_list.filter(lv => assoc_validators_address.includes(lv.address));
                        console.log("Matched ones....")
                        console.log(matched_validators)
                        if(Array.isArray(matched_validators) && matched_validators.length){
                        
                            matched_validators.forEach( (mValidator,i) => {
                                matched_validators[i].voting_power = parseInt(matched_validators[i].voting_power);
                                console.log("stacking power: "+ matched_validators[i].voting_power);
                                if(matched_validators[i].voting_power > 200){ 
                                        flag_mV = true; 
                                }
                            }); 
                        }
                        else{
                            console.log("the address not associated to validator or the validtor is jailed")
                        }
    
        let  balances = response3.data.result;
                        
                        console.log("checking the balances with ....")
                        console.log(balances);
    
                        balances.forEach((balance, i) => {
                        if (balances[i] && balances[i].amount)
                            balances[i].amount = parseFloat(balances[i].amount);
                            console.log("the amount: "+ balances[i].amount)
                            if(balances[i].amount > 10000000){
                                flag_mA = true; 
                            }    
                        }); 
                        console.log("is it greedy validator :  " +flag_mV)
                        console.log("is it greedy address :  "+ flag_mA)
        if (((typeof existingIP == "undefined") || (Date.now()-existingIP.airdropTime >= airdropInterval)) && !flag_mA  && !flag_mV){

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
        //console.log(response1.data);
        //console.log(response2.data);
    })).catch(error => {
        console.log(error);
    });
    
     


   
})

app.listen(port, () => console.log(`Airdropping... ${port}!`))
