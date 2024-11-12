#!/bin/bash
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi
echo "Environment Variables at Startup:" > "$HOME/proxy_startup_env.log"
env >> "$HOME/proxy_startup_env.log"
if command -v npm > /dev/null 2>&1; then
    cd "$HOME/proxy/" || exit
    npm run start >> "$HOME/proxy_startup.log" 2>&1
else
    echo "npm not found" 
fi
