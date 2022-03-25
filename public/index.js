// Setting global variables
let localStream;
let remoteStream;
let peerConnection;
let room;
let clientId;
let dataChannel;
let receiveChannel;
let currentPlayer;
let gameActive;

// Setting up the local stream
let localVideo = document.getElementById('localVideo')
let remoteVideo = document.getElementById('remoteVideo')

// Call & Game Names
let myname = document.getElementById('my-name')
let opponentname = document.getElementById('opponent-name')

// Game elements
const tiles = Array.from(document.querySelectorAll('.tile'));
const playerDisplay = document.querySelector('.display-player');
const resetButton = document.querySelector('#reset');
const announcer = document.querySelector('.announcer');


let board = ['','','','','','','','','']

const PLAYERX_WON = 'PLAYERX_WON';
const PLAYERO_WON = 'PLAYERO_WON';
const TIE = 'TIE';


// Setting up WEBRTC stun servers
var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:stun.stunprotocol.org:3478'},
        {'urls': 'stun:stun.l.google.com:19302'},
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

    // localVideo.srcObject = localStream
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
    // end of data channel helper functions


function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    dataChannel = peerConnection.createDataChannel('game')

    peerConnection.ondatachannel = handleChannelCallback

    dataChannel.onopen = handleChannelOpen;
    dataChannel.onmessage = handleChannelMessage;
    dataChannel.onerror = handleChannelError;
    dataChannel.onclose = handleChannelClose;


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
        myname.innerHTML = 'O'
        opponentname.innerHTML = 'X'
        gameActive = currentPlayer==myname.innerHTML? true:false
    }

}

// Handling Client Receiving Call
socket.on('new-message', message => {
    if (!peerConnection) {
        start(false)
        currentPlayer = 'X'
        myname.innerHTML = 'X'
        opponentname.innerHTML = 'O'
        gameActive = currentPlayer==myname.innerHTML? true:false
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



// xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx


// Sending game action to remote peer
function sendAction(index) {
    const move = index
    dataChannel.send(JSON.stringify({type: 'ACTION', payload: move}))
}

function sendReset() {
    dataChannel.send(JSON.stringify({type: 'RESET', payload: true}))
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
     if (tile.innerText === 'X' || tile.innerText === 'O') {
         return false
     }

     return true
 }

const updateBoard = (index) => {
    board[index] = currentPlayer
}

const changePlayer = () => {
    playerDisplay.classList.remove(`player${currentPlayer}`)
    currentPlayer = currentPlayer === 'X'? 'O':'X'
    playerDisplay.innerText = currentPlayer
    playerDisplay.classList.add(`player${currentPlayer}`)
}

const announce = (type) => {
    switch(type) {
        case PLAYERX_WON:
            announcer.innerHTML = 'Player <span class="playerX">X</span> Won';
            break;
        case PLAYERO_WON:
            announcer.innerHTML = 'Player <span class="playerO">O</span> Won';
            break;
        case TIE:
            announcer.innerHTML = 'The game was tied';
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
        gameActive = false
    }

    if (!board.includes("")) announce(TIE);

}

const userAction = (tile, index) => {
    if (isValidAction(tile) && gameActive) {
        tile.innerText = currentPlayer;
        tile.classList.add(`player${currentPlayer}`);
        updateBoard(index);
        handleResults();
        changePlayer();
    }
};

tiles.forEach( (tile, index) => {
    tile.addEventListener('click', () => {
        if (gameActive) {
            userAction(tile, index)
            sendAction(index)
            gameControl();
        }
    });
});

function handleResetBoard() {
    sendReset()
    resetBoard()
}

const resetBoard = () => {
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = myname.innerHTML=='X'? true:false
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


// socket.on('new-message', message => {
//     console.log(message)
// })

// button.addEventListener('click', () => {
//     socket.emit('message', text.value)
// })

// Game logics