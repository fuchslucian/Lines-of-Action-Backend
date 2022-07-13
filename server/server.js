const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {cors: {origin: '*'}});
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


io.on("connection", (socket) => {

  socket.on("join_room", (roomCode) => {
    socket.join(roomCode);
    socket.roomCode = roomCode
    // gets room size and decides players role => black or white or room full
    let clients = io.sockets.adapter.rooms.get(roomCode)
    let numberOfClientsInRoom = clients ? clients.size : 0
    if (numberOfClientsInRoom == 1){
        io.to(socket.id).emit("receive_role", "black")
    }else if (numberOfClientsInRoom == 2){
        io.to(socket.id).emit("receive_role", "white")
        io.to(roomCode).emit("start_game")
    }else if (numberOfClientsInRoom > 2){
        io.to(socket.id).emit("room_full")
    }
  });

  // check if players stones are all 8-directionally connected
  const checkPlayerWon = (player, board) => {
      // get number of stones
      let number_of_stones = 0
      let stone = [-1,-1]
      for (let i = 0; i < board.length; i++) {
        for (let y = 0; y < board[i].length; y++) {
          if (board[i][y] !== "" && board[i][y].color === player){
            number_of_stones += 1
            stone = [i,y]
          }
        }
      }

      // use bfs to check if all stones are connected
      let queue = [stone]
      board[stone[0]][stone[1]] = ""
      number_of_stones -= 1
      while (queue.length > 0){
        stone = queue.shift()
        let directions = [[0,1],[0,-1],[1,0],[-1,0],[-1,-1],[1,1],[-1,1],[1,-1]]
        directions.forEach(([i,y]) => {
            if (stone[0]+i >= 0 && stone[0]+i < board.length && stone[1]+y >= 0 && stone[1]+y < board.length && board[stone[0]+i][stone[1]+y] !== "" && board[stone[0]+i][stone[1]+y].color === player){
              queue.push([stone[0]+i, stone[1]+y])
              board[stone[0]+i][stone[1]+y] = ""
              number_of_stones -= 1
            }
        })
      }
    // if number_os_stone === 0 => bfs went over all stones and they are all connected
    return number_of_stones === 0
  }

  // get new room data and send it so all players
  socket.on("send_room_data",(roomData) => {
    // check if user diconnected
    
    // check if white is winner
    let white_won = checkPlayerWon("white", JSON.parse(JSON.stringify(roomData.board)))
    // check if black is winner
    let black_won = checkPlayerWon("black", JSON.parse(JSON.stringify(roomData.board)))

    if (white_won && black_won){
      // if both won => send draw
      io.to(roomData.roomCode).emit("get_winner",{
        roomCode: roomData.roomCode,
        board: roomData.board,
        selected: roomData.selected,
        player: "",
        winner: "draw",
        won_through_disconnect: false

      })
      io.to(roomData.roomCode).emit("get_winner",roomData)
    }else if (white_won){
      // if white won => send white won
      io.to(roomData.roomCode).emit("get_winner",{
        roomCode: roomData.roomCode,
        board: roomData.board,
        selected: roomData.selected,
        player: "",
        winner: "white",
        won_through_disconnect: false

      })
    }else if (black_won){
      // if black won => send black won
      io.to(roomData.roomCode).emit("get_winner",{
        roomCode: roomData.roomCode,
        board: roomData.board,
        selected: roomData.selected,
        player: "",
        winner: "black",
        won_through_disconnect: false

      })
    }else{
      // if nobody won => send room data
      io.to(roomData.roomCode).emit("update_room_data",roomData)
    }
  });

  
  socket.on("send_message", (roomData) => {
    io.to(roomData.roomCode).emit("get_message", roomData)
  })

  socket.on('disconnect', () => {
    // gets room size
    let clients = io.sockets.adapter.rooms.get(socket.roomCode)
    let numberOfClientsInRoom = clients ? clients.size : 0

    // if just one player in room => someone disconnected and remaining player wins
    if (numberOfClientsInRoom === 1){
      io.to(socket.roomCode).emit("get_winner",{
        roomCode: socket.roomCode,
        player: "",
        winner: "",
        won_through_disconnect: true

      })
    }
  });

});


http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});
