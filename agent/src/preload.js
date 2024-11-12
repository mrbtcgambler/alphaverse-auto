const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    setRequestHandler: (requestHandler) => ipcRenderer.on('api-request', requestHandler),
    sendApiResponse: (response) => ipcRenderer.send(`api-response-${response.id}`, response)
})