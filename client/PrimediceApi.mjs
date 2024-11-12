import fetch from 'node-fetch-retry-timeout';
import { v4 as uuidv4 } from 'uuid' ;

export default class PrimediceApi {
    constructor(apiKey) {
        this.apiUrl = 'https://api.primedice.com/graphql';
        this.apiKey = apiKey;
    }

    getFunds(currency = 'btc') {
        return this.request({
            operationName: "initialUserRequest",
            query: "query initialUserRequest {\n  user {\n    ...UserAuth\n    __typename\n  }\n}\n\nfragment UserAuth on User {\n  id\n  name\n  email\n  hasPhoneNumberVerified\n  hasEmailVerified\n  hasPassword\n  intercomHash\n  createdAt\n  hasTfaEnabled\n  mixpanelId\n  hasOauth\n  isKycBasicRequired\n  isKycExtendedRequired\n  isKycFullRequired\n  kycBasic {\n    id\n    status\n    __typename\n  }\n  kycExtended {\n    id\n    status\n    __typename\n  }\n  kycFull {\n    id\n    status\n    __typename\n  }\n  flags {\n    flag\n    __typename\n  }\n  roles {\n    name\n    __typename\n  }\n  balances {\n    ...UserBalanceFragment\n    __typename\n  }\n  activeClientSeed {\n    id\n    seed\n    __typename\n  }\n  previousServerSeed {\n    id\n    seed\n    __typename\n  }\n  activeServerSeed {\n    id\n    seedHash\n    nextSeedHash\n    nonce\n    blocked\n    __typename\n  }\n  __typename\n}\n\nfragment UserBalanceFragment on UserBalance {\n  available {\n    amount\n    currency\n    __typename\n  }\n  vault {\n    amount\n    currency\n    __typename\n  }\n  __typename\n}\n",
            "variables": {}
        }).then(result => {
            try {
                const balances = JSON.parse(result).data.user.balances;
                const balance = balances.filter((balance) => balance.available.currency === currency)[0];

                return {
                    available: balance.available.amount || 0,
                    vault: balance.vault.amount || 0,
                    currency: currency
                };
            } catch (e) {
                console.error(e);
                return null;
            }
        });
    }

    getVipProgress() {
        return this.request({
            "query": "query VipProgressMeta {\n  user {\n    id\n    flagProgress {\n      flag\n      progress\n    }\n  }\n}\n",
            "variables": {}
        }).then(result => {
            try {
                const flagProgress = JSON.parse(result).data.user.flagProgress;
                let vipLevel = '';

                switch (flagProgress.flag) {
                    case 'none':
                        vipLevel = 'None';
                        break;
                    case 'bronze':
                        vipLevel = 'Bronze';
                        break;
                    case 'silver':
                        vipLevel = 'Silver';
                        break;
                    case 'gold':
                        vipLevel = 'Gold';
                        break;
                    case 'Plat':
                    case 'wagered(250k)':
                        vipLevel = 'Plat 1';
                        break;
                    case 'wagered(500k)':
                        vipLevel = 'Plat 2';
                        break;
                    case 'wagered(1m)':
                        vipLevel = 'Plat 3';
                        break;
                    case 'wagered(2.5m)':
                        vipLevel = 'Plat 4';
                        break;
                    case 'wagered(5m)':
                        vipLevel = 'Plat 5';
                        break;
                    case 'wagered(10m)':
                        vipLevel = 'Plat 6';
                        break;
                    case 'wagered(25m)':
                        vipLevel = 'Dia 1';
                        break;
                    case 'wagered(50m)':
                        vipLevel = 'Dia 2';
                        break;
                    case 'wagered(100m)':
                        vipLevel = 'Dia 3';
                        break;
                    case 'wagered(250m)':
                        vipLevel = 'Dia 4';
                        break;
                    case 'wagered(500m)':
                        vipLevel = 'Dia 5';
                        break;
                    case 'wagered(1000m)':
                        vipLevel = 'Obs 1';
                        break;
                    case 'wagered(2500m)':
                        vipLevel = 'Obs 2';
                        break;
                    case 'wagered(5000m)':
                        vipLevel = 'Obs 3';
                        break;
                }

                return {
                    flag: vipLevel,
                    progress: flagProgress.progress * 100
                };
            } catch (e) {
                console.error(e);
                return null;
            }
        });
    }

    depositToVault(currency, amount) {
        if (!currency) throw new Error('Missing parameter `currency`.');
        if (!amount) return;

        return this.request({
            "query": "mutation CreateVaultDeposit($currency: CurrencyEnum!, $amount: Float!) {\n  createVaultDeposit(currency: $currency, amount: $amount) {\n    id\n    amount\n    currency\n    user {\n      id\n      balances {\n        available {\n          amount\n          currency\n          __typename\n        }\n        vault {\n          amount\n          currency\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
            "operationName": "CreateVaultDeposit",
            "variables": {"currency": currency, "amount": amount}
        });
    }

    withdrawFromVault(currency, amount, password) {
        if (!currency) throw new Error('Missing parameter `currency`.');
        if (!amount) return;
        if (!password) throw new Error('Missing parameter `password`.');

        amount -= 0.00000001;

        return this.request({
            "query": "mutation CreateVaultWithdrawal($currency: CurrencyEnum!, $amount: Float!, $password: String, $tfaToken: String, $oauthToken: String) {\n  createVaultWithdrawal(\n    currency: $currency\n    amount: $amount\n    password: $password\n    tfaToken: $tfaToken\n    oauthToken: $oauthToken\n  ) {\n    id\n    currency\n    amount\n    user {\n      id\n      hasEmailVerified\n      email\n      balances {\n        ...UserBalance\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment UserBalance on UserBalance {\n  available {\n    amount\n    currency\n    __typename\n  }\n  vault {\n    amount\n    currency\n    __typename\n  }\n}\n",
            "operationName": "CreateVaultWithdrawal",
            "variables": {"currency": currency, "amount": amount, "password": password}
        });
    }

    async tip(currency, amount, receiver) {
        if (!currency) throw new Error('Missing parameter `currency`.');
        if (!amount) return;
        if (!receiver) throw new Error('Missing parameter `receiver`.');

        amount -= 0.00000001;

        const receiverUserId = await this.request({
            "query": "query SendTipMeta($name: String) {\n  user(name: $name) {\n    id\n    name\n    __typename\n  }\n  self: user {\n    id\n    hasTfaEnabled\n    isTfaSessionValid\n    balances {\n      available {\n        amount\n        currency\n        __typename\n      }\n      vault {\n        amount\n        currency\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
            "operationName": "SendTipMeta",
            "variables": {"name": receiver}
        }).then(result => {
            try {
                return JSON.parse(result).data.user.id;
            } catch (e) {
                console.error(e);
                return null;
            }
        });

        return this.request({
            "query": "mutation SendTip($userId: String!, $amount: Float!, $currency: CurrencyEnum!, $isPublic: Boolean, $chatId: String!, $tfaToken: String) {\n  sendTip(\n    userId: $userId\n    amount: $amount\n    currency: $currency\n    isPublic: $isPublic\n    chatId: $chatId\n    tfaToken: $tfaToken\n  ) {\n    id\n    amount\n    currency\n    user {\n      id\n      name\n      __typename\n    }\n    sendBy {\n      id\n      name\n      balances {\n        available {\n          amount\n          currency\n          __typename\n        }\n        vault {\n          amount\n          currency\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
            "operationName": "SendTip",
            "variables": {
                "userId": receiverUserId,
                "amount": amount,
                "currency": currency,
                "isPublic": false,
                "chatId": "f0326994-ee9e-411c-8439-b4997c187b95"
            }
        }).then(result => {
            try {
                console.log(JSON.parse(result));
            } catch (e) {
                console.error(e);
                return null;
            }
        });
    }

    diceRoll(chance, betHigh, betSize, currency) {
        return this.request({
            query: "mutation PrimediceRoll($amount: Float!, $target: Float!, $condition: CasinoGamePrimediceConditionEnum!, $currency: CurrencyEnum!) {\n  primediceRoll(amount: $amount, target: $target, condition: $condition, currency: $currency) {\n    ...CasinoBetFragment\n    state {\n      ...PrimediceStateFragment\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment CasinoBetFragment on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n   balances {\n      available {\n        amount\n        currency\n      }\n      vault {\n        amount\n        currency\n      }\n      __typename\n    }\n __typename\n  }\n  __typename\n}\n\nfragment PrimediceStateFragment on CasinoGamePrimedice {\n  result\n  target\n  condition\n  __typename\n}\n",
            "variables": {
                "target": chance,
                "condition": betHigh ? "above" : "below",
                "identifier": uuidv4(),
                "amount": betSize,
                "currency": currency
            }
        });
    }

    limboBet(target, betSize, currency) {
        return this.request({
            "query": "mutation LimboBet($amount: Float!, $multiplierTarget: Float!, $currency: CurrencyEnum!, $identifier: String!) {\n  limboBet(amount: $amount, currency: $currency, multiplierTarget: $multiplierTarget, identifier: $identifier) {\n    ...CasinoBetFragment\n    state {\n      ...LimboStateFragment\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment CasinoBetFragment on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n    balances {\n      available {\n        amount\n        currency\n      }\n      vault {\n        amount\n        currency\n      }\n      __typename\n    }\n __typename\n  }\n  __typename\n}\n\nfragment LimboStateFragment on CasinoGameLimbo {\n  result\n  multiplierTarget\n  __typename\n}\n",
            "operationName": "LimboBet",
            "variables": {
                "amount": betSize,
                "currency": currency,
                "identifier": uuidv4(),
                "multiplierTarget": parseFloat(target.toFixed(2))
            }
        });
    }

    claimRakeBack() {
        return this.request({
            "query": "mutation ClaimRakeback {\n  claimRakeback {\n    id\n    currency\n    amount\n    __typename\n  }\n}\n",
            "operationName": "ClaimRakeback"
        });
    }

    request(body) {
        const opts = {
            method: 'POST',
            redirect: 'follow',
            retry: 2,
            pause: 500,
            timeout: 5000,
            headers: {
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "Content-Type": "application/json",
                "x-access-token": this.apiKey
            },
            "mode": "cors",
            "credentials": "omit",
            "referrer": "https://stake.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": JSON.stringify(body)
        };

        return fetch(this.apiUrl, opts)
            .then(response => response.text())
            .catch(err => console.log(err));
    }
}