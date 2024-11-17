**🎥 Tutorial Video**

-   **Watch the setup tutorial here:** [YouTube Video](https://youtu.be/GfFnfkWMH8w)

**🖥️ Server Build**

1.  **Update the system** 🔄
    -   sudo apt update
    -   sudo apt upgrade
2.  **Install necessary packages** 📦
    -   sudo apt install net-tools nodejs sshpass jq
    -   sudo apt install openssh-server
3.  **Install NVM (Node Version Manager)** ⚙️
    -   wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh \| bash
4.  **Log out and back in** 🔑
5.  **Install and use Node.js via NVM** 📝
    -   nvm install node
    -   nvm use node
6.  **Clone the repository** 📂
    -   git clone https://github.com/mrbtcgambler/alphaverse-auto.git
    -   cd alphaverse-auto/
7.  **Replace package.json with the server version** 📝
    -   rm package.json
    -   mv server.package.json package.json
8.  **Make scripts executable** 🔧
    -   chmod +x bin/\*.sh
9.  **Update npm and packages** ⬆️
    -   npm install -g npm@10.9.0
    -   npm i -g npm-check-updates
    -   ncu -u
    -   npm install
    -   npm upgrade
10. **Install additional dependencies** 🛠️

bash

Copy code

sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libgbm1 \\

libpango-1.0-0 libpangocairo-1.0-0 libxcomposite1 libxrandr2 libasound2 libatspi2.0-0 \\

libnss3 libxshmfence1 libxdamage1 libx11-xcb1 libxcb-dri3-0 libdbus-glib-1-2 libxfixes3

1.  **Check for missing dependencies** 🔍
    -   ldd /home/user/.cache/puppeteer/chrome/linux-125.0.6422.78/chrome-linux64/chrome \| grep "not found"
2.  **Generate a secure password** 🔐
    -   Visit: [passwordsgenerator.net](https://passwordsgenerator.net/old.php)
3.  **Edit the hosts file** 📝
    -   sudo nano /etc/hosts
4.  **Restart the server** 🔄
    -   ./bin/RestartServer.sh

**📄 Client Template Build**

1.  **Update the system** 🔄
    -   sudo apt update
    -   sudo apt upgrade
2.  **Install necessary packages** 📦
    -   sudo apt install net-tools nodejs sshpass jq
    -   sudo apt install openssh-server git screen
3.  **Install NVM (Node Version Manager)** ⚙️
    -   wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh \| bash
4.  **Log out and back in** 🔑
5.  **Install and use Node.js via NVM** 📝
    -   nvm install node
    -   nvm use node
6.  **Clone the repository** 📂
    -   git clone https://github.com/mrbtcgambler/alphaverse-auto.git
    -   cd alphaverse-auto/
7.  **Make scripts executable** 🔧
    -   chmod +x bin/\*.sh
8.  **Update npm and packages** ⬆️
    -   npm install -g npm@10.9.0
    -   npm i -g npm-check-updates
    -   ncu -u
    -   npm install
    -   npm upgrade
9.  **Edit client_config.json** 📝
    -   nano client_config.json
    -   **Add sudo password & API server information**
10. **Edit the hosts file** 📝
    -   sudo nano /etc/hosts
11. **Build the agent** 🛠️
    -   ./bin/buildAgent.sh
12. **Set permissions for chrome-sandbox** 🔒
    -   sudo chown root \~/proxy/node_modules/electron/dist/chrome-sandbox
    -   sudo chmod 4755 \~/proxy/node_modules/electron/dist/chrome-sandbox
13. **Verify the client setup** ✅
    -   node client/verify.js

**🛡️ Working with VPNs**

1.  **Get Private Internet Access (PIA)** 🔑
    -   Visit: [tinyurl.com/49zawz5r](https://tinyurl.com/49zawz5r)
2.  **Copy VPN files from Discord** 📥
3.  **Install OpenVPN** 📦
    -   sudo apt install openvpn
4.  **Copy VPN configuration file** 📄
    -   sudo cp /home/[username]/VPN/france.ovpn /etc/openvpn/client.conf
5.  **Enable and start OpenVPN service** ⚙️
    -   sudo systemctl enable openvpn@client.service
    -   sudo systemctl daemon-reload
    -   sudo service openvpn@client start
6.  **Install curl to check IP address** 🌐
    -   sudo apt install curl
    -   curl ifconfig.io
7.  **Populate configuration files** 📝
    -   Update client_config.json & server_config.json with necessary information

**📝 Setting Up Config Files**

1.  **Sign up for TronGrid** 🌐
    -   Visit: [trongrid.io](https://www.trongrid.io/)
2.  **Create a TronLink wallet** 💳
    -   Visit: [tronlink.org](https://www.tronlink.org/)

**🚀 Deployment Options**

1.  **Hardware Option** 🖥️
    -   **HP Gen 9 with 128GB RAM**
        -   Search on eBay: HP Gen 9 128GB
2.  **Virtualization Software** 🛠️
    -   **VirtualBox** 🧰
        -   Download: [virtualbox.org/wiki/Downloads](https://www.virtualbox.org/wiki/Downloads)
    -   **XenSource** 🐧
        -   Visit: [xenbits.xen.org](https://xenbits.xen.org/)
    -   **XCP-ng** ⚙️
        -   Download: [xcp-ng.org](https://xcp-ng.org/)
    -   **Proxmox** 🖥️
        -   Download: [proxmox.com/en/downloads](https://www.proxmox.com/en/downloads)

**Note:** Replace [username] with your actual username in file paths.
