jconfirm.defaults = {
    theme: 'dark',
};

const app = Vue.createApp({
    data() {
        return {
            clients: [],
            missingUsernames: [],
            runtime: null,
            presenterMode: false,
            currencyConversionRate: null
        }
    },
  
    mounted() {
        window.setInterval(() => {
            fetch("/status", {
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            })
                .then(response => response.json())
                .then(data => {
                    this.runtime = data.runtime;
                    this.clients = Object
                        .values(data.clients)
                        .sort((a, b) => {
                            // Prioritize clients who have lost connection
                            const aLostConnection = this.hasLostConnection(a);
                            const bLostConnection = this.hasLostConnection(b);
                            if (aLostConnection && !bLostConnection) {
                                return -1;
                            }
                            if (!aLostConnection && bLostConnection) {
                                return 1;
                            }
    
                            // Fallback to existing sorting criteria
                            return firstBy('state').thenBy('username', {ignoreCase: true})(a, b);
                        });
    
                    const connectedUsernames = Object.values(data.clients).map((client) => client.username);
                    this.missingUsernames = data.usernames.filter(x => !connectedUsernames.includes(x));
                });
        }, 500);
        this.fetchBtcUsdValue();
        window.setInterval(() => { this.fetchBtcUsdValue() }, 60000);
    },

    computed: {
        bankroll() {
            return this.clients.reduce((a, b) => a + b.funds.available, 0) + this.clients.reduce((a, b) => a + b.funds.vault, 0);
        },

        totalBetsPerHour() {
            return this.clients.reduce((a, b) => a + b.diceBotState.betsPerHour, 0);
        },

        profit() {
            return this.bankroll - (localStorage.getItem('profitBase') || 0);
        },

        wager() {
            return this.clients.reduce((a, b) => a + b.diceBotState.wager, 0);
        },

        currency() {
            return this.clients[0]?.currency.toUpperCase() || 'XRP';
        },
    },

    methods: {

        hasLostConnection(client) {
            if (!client.diceBotState.lastBet) {
                return false;
            }
            const timeSinceLastBet = new Date() - new Date(client.diceBotState.lastBet);
            return timeSinceLastBet >= 60 * 5 * 1000; // 5 minutes in milliseconds
        },

        updateClient(username) {
            return fetch("/client/update", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: "cors",
                credentials: "include",
                body: JSON.stringify({
                    username: username,
                }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log(`Client ${username} is being updated.`);
                } else {
                    console.error(data.message);
                }
            })
            .catch(error => {
                console.error(`An error occurred while updating the client for ${username}: ${error}`);
            });
        },
    
        getMoment(isoDateTime) {
            return moment.min(moment(), moment(isoDateTime)).fromNow();
        },

        formattedRuntime(secondsRunning) {
            const date = new Date(0);
            date.setSeconds(secondsRunning);

            const distance = date.getTime();
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const padZero = (val, len = 2) => `${val}`.padStart(len, `0`);

            return [padZero(days), padZero(hours), padZero(minutes), padZero(seconds)].join(':');
        },

        resetProfit() {
            localStorage.setItem('profitBase', this.bankroll);
        },

        isIpDuplicate(ipAddress) {
            return this.clients.filter((client) => client.ipAddress === ipAddress).length > 1;
        },

        resetTimer() {
            fetch("/reset-timer", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
            })
                .then(response => response.json())
                .then(response => this.runtime = response.runtime);
        },

        sendVault(origin) {
            const self = this;
            $.confirm({
                title: 'Send vault',
                content: '' +
                    '<form action="" class="formName">' +
                        '<div class="form-group">' +
                            `<label>You're about to send the vault of ${origin} to another user. Who's the receiver?</label>` +
                            '<input type="text" placeholder="Receiver" class="name form-control" required />' +
                        '</div>' +
                    '</form>',
                buttons: {
                    formSubmit: {
                        text: 'Send vault',
                        btnClass: 'btn-blue',
                        action: function () {
                            var receiver = this.$content.find('.name').val();
                            if (!receiver) {
                                $.alert({
                                    title: 'Error!',
                                    content: 'No receiver entered. Not sending any funds.',
                                });

                                return;
                            }

                            self.sendTipVaultRequest(origin, receiver);
                        }
                    },
                    cancel: function () {
                        // Close
                    },
                },
                onContentReady: function () {
                    // bind to events
                    var jc = this;
                    this.$content.find('form').on('submit', function (e) {
                        // if the user submits the form by pressing enter in the field.
                        e.preventDefault();
                        jc.$$formSubmit.trigger('click'); // reference the button and click it
                    });
                }
            });
        },

        updateAllClients() {
            const self = this;
            $.confirm({
                title: 'Update All Clients',
                content: 'This will update all clients. Are you sure?',
                buttons: {
                    confirm: {
                        text: 'Yes, update all',
                        btnClass: 'btn-red',
                        action: function() {
                            self.clients.forEach((client, index) => {
                                setTimeout(() => {
                                    self.updateClient(client.username);
                                }, index * 500); // Adding a delay of 0.5 second between each request
                            });
                        }
                    },
                    cancel: function() {
                        // Cancelled action
                    },
                }
            });
        },
        

        sendAllVaults() {
            const self = this;
            $.confirm({
                title: 'Send all vaults',
                content: '' +
                    '<form action="" class="formName">' +
                        '<div class="form-group">' +
                            `<label>You're about to send all vaults to another user. Who's the receiver?</label>` +
                            '<input type="text" placeholder="Receiver" class="name form-control" required />' +
                        '</div>' +
                    '</form>',
                buttons: {
                    formSubmit: {
                        text: 'Send vaults',
                        btnClass: 'btn-blue',
                        action: function() {
                            var receiver = this.$content.find('.name').val();
                            if (!receiver) {
                                $.alert({
                                    title: 'Error!',
                                    content: 'No receiver entered. Not sending any funds.',
                                });

                                return;
                            }

                            let timeout = 5000;
                            self.clients.forEach(async (client) => {
                                if (client.username === receiver
                                    || client.diceBotState.stage !== 1
                                    || client.funds.vault >= client.recoverAmount
                                ) {
                                    return;
                                }

                                setTimeout(() => {
                                    self.sendTipVaultRequest(client.username, receiver);
                                }, timeout);

                                timeout += 5000;
                            });
                        }
                    },
                    cancel: function () {
                        // Close
                    },
                },
                onContentReady: function () {
                    // bind to events
                    var jc = this;
                    this.$content.find('form').on('submit', function (e) {
                        // if the user submits the form by pressing enter in the field.
                        e.preventDefault();
                        jc.$$formSubmit.trigger('click'); // reference the button and click it
                    });
                }
            });
        },

        sendTip(origin) {
            const self = this;
            $.confirm({
                title: 'Send tip',
                content: '' +
                    '<form action="" class="formName">' +
                    '<div class="form-group">' +
                    `<label>You're about to tip to another user. Who's the receiver?</label>` +
                    '<input type="text" placeholder="Receiver" class="name form-control" required />' +
                    '</div>' +
                    '<div class="form-group">' +
                    `<label>How much would you like to tip?</label>` +
                    '<input type="number" placeholder="Receiver" class="amount form-control" required />' +
                    '</div>' +
                    '</form>',
                buttons: {
                    formSubmit: {
                        text: 'Send tip',
                        btnClass: 'btn-blue',
                        action: function () {
                            var receiver = this.$content.find('.name').val();
                            if (!receiver) {
                                alert('No receiver entered. Not sending any funds.');

                                return;
                            }

                            var amount = parseFloat(this.$content.find('.amount').val());
                            if (!amount) {
                                $.alert({
                                    title: 'Error!',
                                    content: 'No amount entered. Not sending any funds.',
                                });

                                return;
                            }

                            self.sendTipRequest(origin, receiver, amount);
                        }
                    },
                    cancel: function () {
                        // Close
                    },
                },
                onContentReady: function () {
                    // bind to events
                    var jc = this;
                    this.$content.find('form').on('submit', function (e) {
                        // if the user submits the form by pressing enter in the field.
                        e.preventDefault();
                        jc.$$formSubmit.trigger('click'); // reference the button and click it
                    });
                }
            });
        },

        resumeAllBetting() {
            $.confirm({
                title: 'Resume all betting?',
                content: `You're about resume all betting! Are you sure?`,
                buttons: {
                    confirm: {
                        btnClass: 'btn-blue',
                        action: () => {
                            this.clients.forEach(async (client) => {
                                await this.resumeBetting(client.username);
                                await new Promise(r => setTimeout(r, 1000));
                            })
                        }
                    },
                    cancel: function () {
                        return;
                    },
                }
            });
        },

        pauseAllBetting() {
            $.confirm({
                title: 'Pause all betting?',
                content: `You're about pause all betting! Are you sure?`,
                buttons: {
                    confirm: {
                        btnClass: 'btn-blue',
                        action: () => {
                            this.clients.forEach(async (client) => {
                                await this.pauseBetting(client.username);
                                await new Promise(r => setTimeout(r, 1000));
                            });
                        }
                    },
                    cancel: function () {
                        return;
                    },
                }
            });
        },

        resumeBetting(username) {
            return fetch("/dicebot/resume", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    username: username,
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        pauseBetting(username) {
            return fetch("/dicebot/pause", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    username: username,
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        stopDiceBot(username) {
            return fetch("/dicebot/stop", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    username: username,
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        WithdrawVault(username) {
            console.log("WithdrawVault button clicked", username); // Debugging line
            return fetch("/client/WithdrawVault", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    username: username,
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        restartDiceBot(username) {
            return fetch("/dicebot/restart", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    username: username,
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        async sendTipVaultRequest(origin, receiver) {
            return await fetch("/tip", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    origin: origin,
                    receiver: receiver
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        async sendTipRequest(origin, receiver, amount) {
            return await fetch("/justTip", {
                "method": "POST",
                "mode": "cors",
                "credentials": "include",
                "body": JSON.stringify({
                    origin: origin,
                    receiver: receiver,
                    amount: amount
                })
            }).catch(error => {
                $.alert({
                    title: 'Error!',
                    content: JSON.stringify(error),
                });
            });
        },

        async fetchBtcUsdValue() {
            let currency = 'tron';
        
            try {
                const response = await fetch(`https://api.coingecko.com/api/v3/coins/${currency}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                this.currencyConversionRate = data.market_data.current_price.usd;
                console.log('Fetched currency conversion rate:', this.currencyConversionRate);
            } catch (error) {
                console.error('Error fetching currency conversion rate:', error);
            }
        },

        toggleViewMode() {
            if (this.presenterMode) {
                $.confirm({
                    title: 'Disable presenter mode?',
                    content: `Are you sure you want to disable the presenter mode? This can cause data being leaked.`,
                    buttons: {
                        confirm: {
                            btnClass: 'btn-blue',
                            action: () => {
                                this.presenterMode = false;
                            }
                        },
                        cancel: function () {
                            return;
                        },
                    }
                });

                return;
            }

            this.presenterMode = true;
        }
    }
});

app.mount('#app');