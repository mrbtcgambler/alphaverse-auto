cd ~/alphaverse-auto/
screen -S server -X quit
sleep 1
screen -dmS server && screen -S server -X stuff 'cd ~/alphaverse-auto && npm run server\n'
exit
