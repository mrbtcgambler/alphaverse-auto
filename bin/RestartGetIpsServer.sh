cd ~/alphaverse-auto/
screen -S getIPs -X quit
screen -dmS getIPs && screen -S getIPs -X stuff 'cd ~/alphaverse-auto && npm run getIPs\n'
sleep 1
exit