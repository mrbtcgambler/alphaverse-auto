cd ~/alphaverse-auto/
screen -S 2faAPI -X quit
screen -dmS 2faAPI && 2faServer -S 2faAPI -X stuff 'cd ~/alphaverse-auto && npm run 2faAPI\n'
sleep 1
exit