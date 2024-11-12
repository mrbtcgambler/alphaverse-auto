cd ~/alphaverse-auto/
screen -S apiserver -X quit
screen -dmS apiserver && apiserver -S server -X stuff 'cd ~/alphaverse-auto && npm run apiServer\n'
sleep 1
exit

