import 'dotenv/config';
import bodyParser from 'body-parser';
import cosmosjs from '@cosmostation/cosmosjs'
import { reset } from 'nodemon';
//import { Console } from 'console';

const chainId = process.env.CHAIN_ID;
const lcdAddress = process.env.LCD_ADDRESS;
const walletPath = process.env.HD_WALLET_PATH;
const mnemonic = process.env.MNEMONIC;
const bech32Prefix = process.env.BECH32_PREFIX;
const amount = process.env.AMOUNT;
const denom = process.env.DENOM;
const minutes = parseInt(process.env.MINUTES);
const memo = process.env.MEMO;
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

//fucntion to assign default values if not existed in .env

function GetRulesLimit(envVaraible, defaultvalue)
{
    var value =  parseInt(process.env[envVaraible]);
    if(value!=undefined)
        return value;
    else
        return defaultvalue;
}

//fuction check if the address has a validator with voting power higher than defined retriction rule 
const gValidator = async(desmosAddress) => {
    let url1 = lcdAddress+"/validatorsets/latest";
    let url2= lcdAddress+'/cosmos/staking/v1beta1/delegators/'+desmosAddress+'/validators';
    let votingPowerLimit = GetRulesLimit("VOTING_POWER_LIMIT", 200);
    let flagmV = false;
   await  axios.all([
        axios.get(url1),
        axios.get(url2), 
      // axios.get(url3),
    ]).then(axios.spread((response1, response2) => {
        let validatorsList = response1.data.result.validators;
        let assocValidators = response2.data.validators; 
                        console.log("checking associated validator to the delegator address....")
                        //console.log(assocValidators)      
                        let assocValidatorsAddress = assocValidators.map(assocValidator => { return assocValidator.consensus_pubkey.key; });
                        //console.log("Cross-linked Validators:....")
                        //console.log(assocValidatorsAddress)
                        let matchedValidators = validatorsList.filter(lv => assocValidatorsAddress.includes(lv.pub_key.value));
                        //console.log("Matched ones....")
                        //console.log(matchedValidators)
                        if(Array.isArray(matchedValidators) && matchedValidators.length){
                        
                            matchedValidators.forEach( (mValidator,i) => {
                                matchedValidators[i].voting_power = parseInt(matchedValidators[i].voting_power);
                               // console.log("stacking power: "+ matchedValidators[i].voting_power);
                              
                                if(matchedValidators[i].voting_power > votingPowerLimit){ 
                                    flagmV = true; 
                                }
                            }); 
                        }
                        else{
                            console.log("the address not associated to validator or the validtor is jailed")
                            flagmV = false;
                        }
    }));
    console.log("is it greedy validator :  " +flagmV)
  return flagmV;
}

//function to check address's balance satisfy rules limits 

const gAddress = async (desmosAddress) => {
    let url3 = lcdAddress + '/cosmos/bank/v1beta1/balances/'+desmosAddress;
    let res = await axios.get(url3);
    let amountLimit = GetRulesLimit("AMOUNT_LIMIT", 10000000);
    let flagmA = false;
    let  balances = res.data.balances;
                        
                        console.log("checking the balances with ....")
                       // console.log(balances);
    
                        balances.forEach((balance, i) => {
                        if (balances[i] && balances[i].amount)
                            balances[i].amount = parseFloat(balances[i].amount);
                         //   console.log("the amount: "+ balances[i].amount)
                            if(balances[i].amount > amountLimit){
                                flagmA = true; 
                            }    
                        }); 
                        console.log("is it greedy address :  "+ flagmA)
    return flagmA



}

// function that handle rules and restruction and check the validaity of the request for given desmos address 

const rulesChecked  = async (ip, desmosAddress) => {
    ip = ip.split(",").map(item => item.trim());
    ip = ip[0];
    let existingIP = historyStore
        .find({ ip: ip })
        .value()
    let isGValidator  = await gValidator(desmosAddress);
    let isGAddress = await gAddress(desmosAddress);

    if (((typeof existingIP == "undefined") || (Date.now()-existingIP.airdropTime >= airdropInterval)) && (isGValidator ==  false)  && (isGAddress == false)){
        console.log("Address is permitted for faucet.....");
        return true;
    }
    else{
        console.log("Address is rejected for fund.......");
        return false;
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
    rulesChecked(ip,req.body.address).then( (result) => {
    if ( result == true){
                       
            cosmos.getAccounts(address).then(data => {

                
                let stdSignMsg = cosmos.newStdMsg({
                    msgs: [
                        {
                            type: "cosmos-sdk/MsgSend",
                            value: {
                                amount: [
                                    {
                                        amount: String(amount),
                                        denom: denom
                                    }
                                ],
                                from_address: address,
                                to_address: req.body.address
                            }
                        }
                    ],
                    chain_id: chainId,
                    fee: { amount: [ { amount: String(0), denom: denom } ], gas: String(200000) },
                    memo: memo,
                    account_number: String(data.result.value.account_number),
                    sequence: String(data.result.value.sequence)
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
        
    });
   
    
     


   
})

app.listen(port, () => console.log(`Airdropping... ${port}!`))
