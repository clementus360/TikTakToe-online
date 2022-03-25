const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const io = require('socket.io')(server, {
    cors: {
		origin: "http://localhost:3000",
		methods: [ "GET", "POST" ]
	}
})

app.use(express.static("public"));

let roomClients = 0
let roomId = 0

io.on("connection", (socket) => {

    roomClients++;
    
    if ( roomClients === 3) {
        roomClients = 1
        roomId++
    }

    socket.join(`game${roomId}`)
    console.log(`game${roomId}`)
    socket.emit('room', {
        room: `game${roomId}`,
        clientId: roomClients
    })

    socket.on('message', message => {
        let signal = JSON.parse(message)
        socket.broadcast.to(signal.room).emit('new-message', message)
    })

})

server.listen(3000)