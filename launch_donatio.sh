#!/bin/bash

PROJECT_DIR="$(pwd)"

# Termina processi esistenti
echo "Controllo se ci sono istanze precedenti di Hardhat in esecuzione..."
PORT_PID=$(lsof -i :8545 -t 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "Terminazione del processo sulla porta 8545 (PID: $PORT_PID)..."
    kill -9 $PORT_PID
    sleep 1
fi

# Reset ANCORA PIÙ COMPLETO dell'ambiente
echo "Pulizia completa dell'ambiente di sviluppo..."
rm -rf "${PROJECT_DIR}/cache"
rm -rf "${PROJECT_DIR}/artifacts"
rm -rf "${PROJECT_DIR}/.hardhat" 2>/dev/null
rm -rf "${PROJECT_DIR}/typechain" 2>/dev/null
rm -rf "${PROJECT_DIR}/typechain-types" 2>/dev/null
rm -rf "${PROJECT_DIR}/deployments/localhost" 2>/dev/null

# Pulizia più approfondita del frontend
echo "Pulizia cache frontend..."
rm -f "${PROJECT_DIR}/frontend/src/contracts/contract-address.json"
rm -rf "${PROJECT_DIR}/frontend/node_modules/.cache"
rm -rf "${PROJECT_DIR}/frontend/.parcel-cache" 2>/dev/null

# Forza ricompilazione dei contratti
echo "Ricompilazione contratti..."
cd "${PROJECT_DIR}" && npx hardhat compile --force

osascript <<EOD
tell application "iTerm"
    create window with default profile
    
    # Imposta la finestra a schermo intero
    tell current window
        set fullscreen to true
        delay 0.5
    end tell
    
    tell current session of current window
        write text "cd '${PROJECT_DIR}' && clear && echo 'Avvio Hardhat Node...' && npx hardhat node"
    end tell
    
    tell current window
        create tab with default profile
        tell current session of current tab
            write text "cd '${PROJECT_DIR}' && clear && echo 'Attendere avvio del nodo...' && sleep 3 && echo 'Deploy dei contratti...' && npx hardhat run scripts/deploy.js --network localhost"
        end tell
    end tell
    
    tell current window
        create tab with default profile
        tell current session of current tab
            write text "cd '${PROJECT_DIR}/frontend' && clear && echo 'Attendere deploy dei contratti...' && sleep 4 && echo 'Avvio frontend...' && npm run start"
        end tell
    end tell
    
    activate
end tell
EOD

echo "Donatio avviato con reset completo in iTerm2 a schermo intero"