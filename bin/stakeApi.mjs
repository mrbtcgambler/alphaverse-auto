import fetch from 'node-fetch-retry-timeout';
import { v4 as uuidv4 } from 'uuid';
import twoFactor from 'node-2fa';

const getRandomNumber = (limit = 40) => {
    const min = Math.ceil(0);
    const max = Math.floor(limit);
    return Math.floor(Math.random() * (max - min) + min) + " ";
};

class StakeApi {
    apiUrl;
    apiKey;
    latency;
    lastUsedTwoFaToken;

    constructor(apiKey) {
        this.apiUrl = 'http://localhost:8080';
        this.apiKey = apiKey;
        this.latency = 0;
    }

    getFunds(currency = 'btc') {
        return this.request({
            "operationName": "UserVaultBalances",
            "variables": {},
            "query": "query UserVaultBalances {\n  user {\n    id\n    balances {\n      available {\n        amount\n        currency\n        __typename\n      }\n      vault {\n        amount\n        currency\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"
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

    getWelcomeOfferCode() {
        return this.request({
            "query": "query UserMeta($name: String, $signupCode: Boolean = false) {\n  user(name: $name) {\n    id\n    name\n    isMuted\n    isRainproof\n    isBanned\n    createdAt\n    campaignSet\n    selfExclude {\n      id\n      status\n      active\n      createdAt\n      expireAt\n    }\n    signupCode @include(if: $signupCode) {\n      id\n      code {\n        id\n        code\n      }\n    }\n  }\n}\n",
            "variables": {"signupCode": true}
        }).then(async (result) => {
            try {
                const data = JSON.parse(result);

                if (!data.data.user.signupCode) {
                    return null;
                }

                return data.data.user.signupCode.code.code.toLowerCase();
            } catch (e) {
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

    async depositTRX(privateKey, amount, toAddress) {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { "TRON-PRO-API-KEY": "xxxxxxxxxxxxxxx" },
        });

        const fromAddress = tronWeb.address.fromPrivateKey(privateKey);
        
        try {
            const transaction = await tronWeb.transactionBuilder.sendTrx(toAddress, amount * 1_000_000, fromAddress);
            const signedTransaction = await tronWeb.trx.sign(transaction, privateKey);
            const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
            console.log(`Deposited ${amount} TRX. Transaction hash: ${result.txid}`);
            return result.txid;
        } catch (error) {
            console.error('Failed to deposit TRX:', error);
            return null;
        }
    }

    async withdraw(currency, address, amount, twoFaSecret = null, chain = null) {
        if (!currency) throw new Error('Missing parameter `currency`.');
        if (!address) throw new Error('Missing parameter `address`.');
        if (!amount || amount <= 0) throw new Error('Invalid withdrawal amount.');
        console.log(`Going to withdraw to address: ${address} for the amount: ${amount}${currency} (chain: ${chain})`)
        const variables = {"currency": currency, "address": address, "amount": amount, "chain": chain};

        if (twoFaSecret) {
            variables.tfaToken = await this.generateTwoFaToken(twoFaSecret);
        }

        return this.request({
            "query": "mutation CreateWithdrawal($chain: CryptoChainEnum, $currency: CryptoCurrencyEnum!, $address: String!, $amount: Float!, $emailCode: String, $tfaToken: String, $oauthToken: String) {\n  createWithdrawal(\n    chain: $chain\n    currency: $currency\n    address: $address\n    amount: $amount\n    emailCode: $emailCode\n    tfaToken: $tfaToken\n    oauthToken: $oauthToken\n  ) {\n    id\n  }\n}\n",
            "variables": variables
        }).then(result => {
            const data = JSON.parse(result);
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }
            if (!data.data || !data.data.createWithdrawal) {
                throw new Error('Unexpected response from server');
            }
            return data.data.createWithdrawal;
        });
    }

    async withdrawFromVault(currency, amount, password, twoFaSecret = null) {
        if (!currency) throw new Error('Missing parameter `currency`.');
        if (!amount) return;
        if (!password) throw new Error('Missing parameter `password`.');

        amount -= 0.00000001;

        const variables = {"currency": currency, "amount": amount, "password": password};

        if (twoFaSecret) {
            variables.tfaToken = await this.generateTwoFaToken(twoFaSecret);
        }

        return this.request({
            "query": "mutation CreateVaultWithdrawal($currency: CurrencyEnum!, $amount: Float!, $password: String, $tfaToken: String, $oauthToken: String) {\n  createVaultWithdrawal(\n    currency: $currency\n    amount: $amount\n    password: $password\n    tfaToken: $tfaToken\n    oauthToken: $oauthToken\n  ) {\n    id\n    currency\n    amount\n    user {\n      id\n      hasEmailVerified\n      email\n      balances {\n        ...UserBalance\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment UserBalance on UserBalance {\n  available {\n    amount\n    currency\n    __typename\n  }\n  vault {\n    amount\n    currency\n    __typename\n  }\n}\n",
            "operationName": "CreateVaultWithdrawal",
            "variables": variables
        });
    }

    async tip(currency, amount, receiver, twoFaSecret = null) {
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

        const variables = {
            "userId": receiverUserId,
            "amount": amount,
            "currency": currency,
            "isPublic": false,
            "chatId": "f0326994-ee9e-411c-8439-b4997c187b95"
        };

        if (twoFaSecret) {
            variables.tfaToken = await this.generateTwoFaToken(twoFaSecret);
        }

        return this.request({
            "query": "mutation SendTip($userId: String!, $amount: Float!, $currency: CurrencyEnum!, $isPublic: Boolean, $chatId: String!, $tfaToken: String) {\n  sendTip(\n    userId: $userId\n    amount: $amount\n    currency\n    isPublic\n    chatId\n    tfaToken\n  ) {\n    id\n    amount\n    currency\n    user {\n      id\n      name\n      __typename\n    }\n    sendBy {\n      id\n      name\n      balances {\n        available {\n          amount\n          currency\n          __typename\n        }\n        vault {\n          amount\n          currency\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
            "operationName": "SendTip",
            "variables": variables
        }).then(result => {
            try {
                console.log(JSON.parse(result));
            } catch (e) {
                console.error(e);
                return null;
            }
        });
    }

    resetSeed() {
        return this.request({
            "query": "mutation RotateSeedPair($seed: String!) {\n  rotateSeedPair(seed: $seed) {\n    clientSeed {\n      user {\n        id\n        activeClientSeed {\n          id\n          seed\n          __typename\n        }\n        activeServerSeed {\n          id\n          nonce\n          seedHash\n          nextSeedHash\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
            "operationName": "RotateSeedPair",
            "variables": {
                "seed": uuidv4()
            }
        });
    }

    claimReload(currency) {
        if (!currency) throw new Error('Missing parameter currency.');

        const variables = {
            "currency": currency
        };
        
        return this.request({
            "query": "query ClaimReloadMeta($currency: CurrencyEnum!) {\n  user {\n    id\n    flags {\n      flag\n    }\n    flagProgress {\n      flag\n    }\n    reload: faucet {\n      id\n      amount(currency: $currency)\n      active\n      claimInterval\n      lastClaim\n      expireAt\n      createdAt\n      updatedAt\n    }\n  }\n}\n","variables": variables
        }).then(result => {
            try {
                console.log(JSON.parse(result));
            } catch (e) {
                console.error(e);
                return null;
            }
        });
    }

    diamondsBet(betSize, currency) {
        return this.request({
            "query": "mutation DiamondsBet($amount: Float!, $currency: CurrencyEnum!, $identifier: String) {\n  diamondsBet(amount: $amount, currency: $currency, identifier: $identifier) {\n    ...CasinoBet\n    state {\n      ...CasinoGameDiamonds\n    }\n  }\n}\n\nfragment CasinoBet on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n    balances {\n      available {\n        amount\n        currency\n      }\n      vault {\n        amount\n        currency\n      }\n}\n}\n\nfragment CasinoGameDiamonds on CasinoGameDiamonds {\n  hand\n}\n",
            "variables": {
                "currency": currency,
                "amount": betSize,
                "identifier": uuidv4(),
            }
        });
    }

    diceRoll(chance, betHigh, betSize, currency) {
        if (betHigh) {
            chance = 100 - chance;
        }

        return this.request({
            "query": "mutation DiceRoll($amount: Float!, $target: Float!, $condition: CasinoGameDiceConditionEnum!, $currency: CurrencyEnum!, $identifier: String!) {\n  diceRoll(\n    amount: $amount\n    target: $target\n    condition: $condition\n    currency: $currency\n    identifier: $identifier\n  ) {\n    ...CasinoBet\n    state {\n      ...CasinoGameDice\n    }\n  }\n}\n\nfragment CasinoBet on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n    balances {\n      available {\n        amount\n        currency\n        __typename\n      }\n      vault {\n        amount\n        currency\n        __typename\n      }\n      __typename\n    }\n  }\n}\n\nfragment CasinoGameDice on CasinoGameDice {\n  result\n  target\n  condition\n}\n",
            "variables": {
                "target": chance,
                "condition": betHigh ? "above" : "below",
                "identifier": uuidv4(),
                "amount": betSize,
                "currency": currency
            }
        });
    }

    dragonTowerBet(eggs, difficulty, betSize, currency) {
        return this.request({
            "variables": {
                "amount": betSize,
                "currency": currency,
                "identifier": uuidv4(),
                "difficulty": difficulty,
                "eggs": eggs
            },
            "query": `
mutation DragonTowerBet($amount: Float!, $currency: CurrencyEnum!, $difficulty: DragonTowerDifficultyEnum!, $eggs: [Int!]!, $identifier: String) {
    dragonTowerBet(
        amount: $amount
        currency: $currency
        difficulty: $difficulty
        eggs: $eggs
        identifier: $identifier
    ) {
        ...CasinoBet
        state {
            ...CasinoGameDragonTower
        }
    }
}

fragment CasinoBet on CasinoBet {
    id
    active
    nonce
    payoutMultiplier
    amountMultiplier
    amount
    payout
    updatedAt
    currency
    game
    user {
        id
        name
        balances {
            available {
                amount
                currency
            }

            vault {
                amount
                currency
            }
        }
    }
}

fragment CasinoGameDragonTower on CasinoGameDragonTower {
    currentRound
    playedRounds
    difficulty
    rounds
    tilesSelected
}`
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

    baccaratBet(tie, player, banker, currency) {
        return this.request({
            "query": `
                mutation BaccaratBet(
                    $currency: CurrencyEnum!,
                    $identifier: String!,
                    $tie: Float!,
                    $player: Float!,
                    $banker: Float!
                ) {
                    baccaratBet(
                        currency: $currency,
                        identifier: $identifier,
                        tie: $tie,
                        player: $player,
                        banker: $banker
                    ) {
                        ...CasinoBet
                        state {
                            ...CasinoGameBaccarat
                        }
                    }
                }

                fragment CasinoBet on CasinoBet {
                    id
                    active
                    payoutMultiplier
                    amountMultiplier
                    amount
                    payout
                    updatedAt
                    currency
                    game
                    user {
                        id
                        name
                        balances {
                            available {
                                amount
                                currency
                            }
                            vault {
                                amount
                                currency
                            }
                        }
                    }
                }

                fragment CasinoGameBaccarat on CasinoGameBaccarat {
                    playerCards {
                        suit
                        rank
                    }
                    bankerCards {
                        suit
                        rank
                    }
                    tie
                    player
                    banker
                    result
                }
            `,
            "variables": {
                "currency": currency,
                "identifier": uuidv4(),
                "tie": tie,
                "player": player,
                "banker": banker
            }
        });
    }

    BlackjackNextBet(action) {
        return this.request({
            query:
                "mutation BlackjackNext($action: BlackjackNextActionInput!, $identifier: String!) {\n  blackjackNext(action: $action, identifier: $identifier) {\n    ...CasinoBet\n    state {\n      ...CasinoGameBlackjack\n    }\n  }\n}\n\nfragment CasinoBet on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n  }\n}\n\nfragment CasinoGameBlackjack on CasinoGameBlackjack {\n  player {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n  dealer {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n}\n",
            variables: {
                action: action,
                identifier: getRandomNumber(100000),
            },
        });
    }

    BlackjackActiveBet() {
        return this.request({
            query:
                "query BlackjackActiveBet {\n  user {\n    id\n    activeCasinoBet(game: blackjack) {\n      ...CasinoBet\n      state {\n        ...CasinoGameBlackjack\n      }\n    }\n  }\n}\n\nfragment CasinoBet on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n  }\n}\n\nfragment CasinoGameBlackjack on CasinoGameBlackjack {\n  player {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n  dealer {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n}\n",
        });
    }

    BlackjackBet(betSize, currency) {
        return this.request({
            query:
                "mutation BlackjackBet($amount: Float!, $currency: CurrencyEnum!, $identifier: String!) {\n  blackjackBet(amount: $amount, currency: $currency, identifier: $identifier) {\n    ...CasinoBet\n    state {\n      ...CasinoGameBlackjack\n    }\n  }\n}\n\nfragment CasinoBet on CasinoBet {\n  id\n  active\n  payoutMultiplier\n  amountMultiplier\n  amount\n  payout\n  updatedAt\n  currency\n  game\n  user {\n    id\n    name\n  }\n}\n\nfragment CasinoGameBlackjack on CasinoGameBlackjack {\n  player {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n  dealer {\n    value\n    actions\n    cards {\n      rank\n      suit\n    }\n  }\n}\n",
            variables: {
                currency: currency,
                amount: betSize,
                identifier: getRandomNumber(100000),
            },
        });
    }

    rouletteBet(numbers, colors, rows, ranges, parities, currency) {
        return this.request({
            "variables": {
                "currency": currency,
                "identifier": uuidv4(),
                "numbers": numbers,
                "colors": colors,
                "rows": rows,
                "ranges": ranges,
                "parities": parities,
            },
            "query": `
mutation RouletteBet($currency: CurrencyEnum!, $colors: [RouletteBetColorsInput!], $numbers: [RouletteBetNumbersInput!], $parities: [RouletteBetParitiesInput!], $ranges: [RouletteBetRangesInput!], $rows: [RouletteBetRowsInput!], $identifier: String!) {
    rouletteBet(
        currency: $currency
        colors: $colors
        numbers: $numbers
        parities: $parities
        ranges: $ranges
        rows: $rows
        identifier: $identifier
    ) {
        ...CasinoBet
        state {
            ...RouletteStateFragment
        }
    }
}

fragment CasinoBet on CasinoBet {
    id
    active
    nonce
    payoutMultiplier
    amountMultiplier
    amount
    payout
    updatedAt
    currency
    game
    user {
        id
        name
        balances {
            available {
                amount
                currency
            }

            vault {
                amount
                currency
            }
        }
    }
}

fragment RouletteStateFragment on CasinoGameRoulette {
    result
    colors {
        amount
        value
    }
    numbers {
        amount
        value
    }
    parities {
        amount
        value
    }
    ranges {
        amount
        value
    }
    rows {
        amount
        value
    }
}`
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.61 Safari/537.36",
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
        },
            startDateTime = new Date();

        return fetch(this.apiUrl, opts)
            .then(response => {
                this.latency = (new Date()).getTime() - startDateTime.getTime();

                return response.text();
            })
            .catch(err => console.log(err));
    }

    async generateTwoFaToken(twoFaSecret) {
        let token = twoFactor.generateToken(twoFaSecret).token;

        while (token === this.lastUsedTwoFaToken) {
            token = twoFactor.generateToken(twoFaSecret).token;
            await new Promise(r => setTimeout(r, 1000));
        }

        this.lastUsedTwoFaToken = token;

        return token;
    }
}

export default StakeApi;
