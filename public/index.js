window.onload = (function game() {

// Setting global variables
let localStream;
let peerConnection;
let room;
let clientId;
let dataChannel;
let currentPlayer;
let myPlayer;
let gameActive;

// Setting up the local stream
let localVideo = document.getElementById('localVideo')
let remoteVideo = document.getElementById('remoteVideo')

// Call & Game Names
let myname = document.getElementById('my-name')
let opponentname = document.getElementById('opponent-name')

// Game elements
const tiles = Array.from(document.querySelectorAll('.tile'));
const resetButton = document.querySelector('#reset');
const announcer = document.querySelector('.announcer');
const myUnderline = document.querySelector('.my-underline')
const opponentUnderline = document.querySelector('.opponent-underline')


let board = ['','','','','','','','','']

const PLAYERX_WON = 'PLAYERX_WON';
const PLAYERO_WON = 'PLAYERO_WON';
const TIE = 'TIE';

// Setting up WEBRTC stun servers
var peerConnectionConfig = {
    iceServers: [
        {urls: 'stun:stun.l.google.com:19302?transport=tcp'},
        {urls: 'stun:stun1.l.google.com:19302?transport=tcp'},
        {urls: 'stun:stun.stunprotocol.org:3478?transport=tcp'},
        {urls: 'stun:stun.voiparound.com?transport=tcp'},
        {urls: 'stun:stun.fwdnet.net?transport=tcp'},
    ]
};

// Setting up client-side Socket.io
let socket = io();

socket.on('room', message => {
    room = message.room
    clientId = message.clientId

})

// Creating an ID
const uuid = createUUID()

let constraints = {
    video: true,
    audio: true
}

if(navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia(constraints)
        .then (stream => {
            localStream = stream
            localVideo.srcObject = localStream

            if (clientId == 2) {
                console.log('it shube working')
                start(true)
            }  
        }).catch(errorHandler)

} else {
    alert('Your browser does not support getUserMedia API');
}

// Handling Client Send Call 

    // data channel helper functions
    let handleChannelOpen = event => {
        console.log('datachannel opened')
    }

    let handleChannelError = event => {
        console.log('datachannel has met an error')
    }

    let handleChannelClose = event => {
        console.log('datachannel has closed')
    }

    let handleChannelMessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'ACTION') {
            gameControl();
            userAction(tiles[message.payload], message.payload)
        } else if (message.type === 'RESET') {
            resetBoard();
        }
    }

    let handleChannelCallback = event => {
        dataChannel = event.channel;
        dataChannel.onopen = handleChannelOpen;
        dataChannel.onmessage = handleChannelMessage;
        dataChannel.onerror = handleChannelError;
        dataChannel.onclose = handleChannelClose;
    }

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    dataChannel = peerConnection.createDataChannel('game')
    peerConnection.ondatachannel = handleChannelCallback

    dataChannel.onopen = handleChannelOpen;
    dataChannel.onmessage = handleChannelMessage;
    dataChannel.onerror = handleChannelError;
    dataChannel.onclose = handleChannelClose;

    peerConnection.onconnectionstatechange = e => {
        if(peerConnection.connectionState == 'disconnected') {
            handleResetBoard()
            dataChannel.close()
            peerConnection.close()
            gameActive= false
            game()
        }
    }

    peerConnection.onicecandidate = e => {
        if(e.candidate != null) {
            socket.emit('message', JSON.stringify({'ice': e.candidate, 'uuid': uuid, 'room': room}))
        }
    };

    peerConnection.ontrack = e => {
        console.log('got a remote stream')
        remoteVideo.srcObject = e.streams[0]
    }

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    if(isCaller) {
        peerConnection.createOffer().then(handleDescription).catch(errorHandler)
        currentPlayer = 'X'
        myPlayer = 'O'
        myname.innerHTML = `<img src="./src/O.svg">`
        opponentname.innerHTML = `<img src="./src/X.svg">`

        myUnderline.classList.add('hide')
        opponentUnderline.classList.remove('hide')

        myUnderline.classList.remove('playerX-Underline')
        myUnderline.classList.add('playerO-Underline')

        opponentUnderline.classList.remove('playerO-Underline')
        opponentUnderline.classList.add('playerX-Underline')
        gameActive = currentPlayer==myPlayer? true:false
    }
}

// Handling Client Receiving Call
socket.on('new-message', message => {
    if (!peerConnection) {
        start(false)
        currentPlayer = 'X'
        myPlayer = 'X'
        myname.innerHTML = `<img src="./src/X.svg">`
        opponentname.innerHTML = `<img src="./src/O.svg">`

        myUnderline.classList.remove('hide')
        opponentUnderline.classList.add('hide')

        myUnderline.classList.remove('playerO-Underline')
        myUnderline.classList.add('playerX-Underline')

        opponentUnderline.classList.remove('playerX-Underline')
        opponentUnderline.classList.add('playerO-Underline')
        
        gameActive = currentPlayer==myPlayer? true:false
    }

    let signal = JSON.parse(message)

    if (signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then (() => {
                if(signal.sdp.type === 'offer') {
                    peerConnection.createAnswer().then(handleDescription).catch(errorHandler)
                }
            }).catch(errorHandler)
    }
    else if (signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
})

//Create and Send Session Description
function handleDescription(e) {
    peerConnection.setLocalDescription(e)
        .then ( () => {
            socket.emit('message', JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid, 'room': room}))
        })
}

// Error Handling function
function errorHandler(error) {
    alert('Call Error')
    alert(error)
}

// Generating a random unique ID
function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}

// Sending game actions to remote peer
function sendAction(index) {
    const move = index
    dataChannel.send(JSON.stringify({type: 'ACTION', payload: move}))
}

function sendReset() {
    dataChannel.send(JSON.stringify({type: 'RESET'}))
}

function gameControl() {
    gameActive = gameActive? false:true
 }

// GAME LOGIC

/*
   Indexes within the board
   [0] [1] [2]
   [3] [4] [5]
   [6] [7] [8]
*/

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
 ];

 const isValidAction = (tile) => {
     if (tile.innerHTML === `<img src="./src/O.svg">` || tile.innerHTML === `<img src="./src/X.svg">`) {
         return false
     }

     return true
 }

const updateBoard = (index) => {
    board[index] = currentPlayer
}

const changePlayer = () => {
    currentPlayer = currentPlayer === 'X'? 'O':'X'
    if (currentPlayer == myPlayer) {
        myUnderline.classList.remove('hide')
        opponentUnderline.classList.add('hide')
    } else {
        myUnderline.classList.add('hide')
        opponentUnderline.classList.remove('hide')
    }
}

const announce = (type) => {
    switch(type) {
        case PLAYERX_WON:
            announcer.innerHTML = 'PLAYER <span class="playerX">X</span> WON';
            break;
        case PLAYERO_WON:
            announcer.innerHTML = 'PLAYER <span class="playerO">O</span> WON';
            break;
        case TIE:
            announcer.innerHTML = 'THE GAME WAS TIED';
            break;
    }

    announcer.classList.remove('hide');
}

const handleResults = () => {
    let roundWon = false 
    for (let i = 0; i <= 7; i++) {
        const winCondition = winningConditions[i];
        a = board[winCondition[0]]
        b = board[winCondition[1]]
        c = board[winCondition[2]]
        if (a === '' || b === '' || c === '') {
            continue;
        }

        if ( a === b && b === c) {
            roundWon = true;
            break;
        }  
    }

    if (roundWon) {
        announce (currentPlayer === 'X' ? PLAYERX_WON:PLAYERO_WON );
        confetti();
        gameActive = false
    }

    if (!board.includes("")) announce(TIE);

}

const userAction = (tile, index) => {
    if (isValidAction(tile) && gameActive) {
        tile.innerHTML = `<img src="./src/${currentPlayer}.svg">`
        updateBoard(index);
        handleResults();
        changePlayer();
    }
};

tiles.forEach( (tile, index) => {
    tile.addEventListener('click', () => {
        if (gameActive) {
            console.log(isValidAction(tile))
            if (isValidAction(tile) && gameActive) {
                sendAction(index)
            }

            userAction(tile, index)
            console.log(gameActive)
            if (isValidAction(tile) && gameActive) {
                gameControl();
            }
            console.log(gameActive)
        }
    });
});

function handleResetBoard() {
    sendReset()
    resetBoard()
}

const resetBoard = () => {
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = myPlayer=='X'? true:false
    announcer.classList.add('hide');

    if (currentPlayer === 'O') {
        changePlayer();
    }

    tiles.forEach(tile => {
        tile.innerText = '';
        tile.classList.remove('playerX');
        tile.classList.remove('playerO');
    });
}

resetButton.addEventListener('click', handleResetBoard);

}())

