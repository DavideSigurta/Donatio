#!/bin/bash
# filepath: /Users/davide/Desktop/Universita/Programmi/eth/Donatio/launch_donatio.sh

PROJECT_DIR="$(pwd)"

# Controlla se la porta 8545 è già in uso e termina il processo
echo "Controllo se ci sono istanze precedenti di Hardhat in esecuzione..."
PORT_PID=$(lsof -i :8545 -t 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "Terminazione del processo sulla porta 8545 (PID: $PORT_PID)..."
    kill -9 $PORT_PID
    sleep 1
fi

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
            write text "cd '${PROJECT_DIR}/frontend' && clear && echo 'Attendere deploy dei contratti...' && sleep 2 && echo 'Avvio frontend...' && npm start"
        end tell
    end tell
    
    activate
end tell
EOD

echo "Donatio avviato in iTerm2 a schermo intero"