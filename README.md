# Desmos Faucet

Rename `.env.sample` to `.env` and update the faucet wallet mnemonic phrase.

``` sh
npm install --save
npm start
```

Then post an address to `http://localhost:3456/airdrop` endpoint.

``` sh
curl -X POST -H "Content-Type:application/json" http://localhost:3456/airdrop -d '{"address":"desmos1tws35nang4va8edrxl35xpr3lpmqxwg2gk7fp4"}'
```
