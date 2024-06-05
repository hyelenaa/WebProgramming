'use strict';

let userNames = (function () {
  let names = {};

  let claim = function (name) {
    if (!name || names[name]) {
      return false;
    } else {
      names[name] = true;
      return true;
    }
  };

  let getGuestName = function () {
    let name,
      nextUserId = 1;

    do {
      name = 'Guest ' + nextUserId;
      nextUserId += 1;
    } while (!claim(name));

    return name;
  };

  let get = function () {
    let res = [];
    for (let user in names) {
      res.push(user);
    }

    return res;
  };

  let free = function (name) {
    if (names[name]) {
      delete names[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getGuestName: getGuestName
  };
}());

let rooms = {};

const manageRooms = (function () {
  return {
    createRoom: function (roomName) {
      if (!rooms[roomName]) {
        rooms[roomName] = { users: [], messages: [] };
      }
    },
    getRoom: function (roomName) {
      return rooms[roomName];
    },
    roomExists: function (roomName) {
      return !!rooms[roomName];
    },
    addUserToRoom: function (roomName, userName) {
      if (rooms[roomName] && !rooms[roomName].users.includes(userName)) {
        rooms[roomName].users.push(userName);
      }
    },
    removeUserFromRoom: function (roomName, userName) {
      if (rooms[roomName]) {
        rooms[roomName].users = rooms[roomName].users.filter(user => user !== userName);
        if (rooms[roomName].users.length === 0) {
          delete rooms[roomName];
        }
      }
    },
    addMessageToRoom: function (roomName, message) {
      if (rooms[roomName]) {
        rooms[roomName].messages.push(message);
      }
    }
  };
}());

module.exports = function (socket, io) {
  let name = userNames.getGuestName();

  socket.emit('init', {
    name: name,
    users: userNames.get(),
    rooms: Object.keys(rooms)
  });

  socket.broadcast.emit('user:join', {
    name: name
  });

  socket.on('send:message', function (data) {
    const message = {
      user: data.user,
      text: data.text,
      room: data.room
    };

    // Ensure `io` is properly used to emit the message to the specified room
    if (io) {
      io.to(data.room).emit('send:message', message);
      console.log(`Message sent to room ${data.room}: ${data.text}`);
    } else {
      console.error('io is not defined');
    }

    // Add the message to the room's message array
    manageRooms.addMessageToRoom(data.room, message);
  });

  socket.on('change:name', function (data, fn) {
    if (userNames.claim(data.name)) {
      let oldName = name;
      userNames.free(oldName);

      name = data.name;

      socket.broadcast.emit('change:name', {
        oldName: oldName,
        newName: name
      });

      fn(true);
    } else {
      fn(false);
    }
  });

  socket.on('room:search', function (data) {
    const roomName = data.roomName;
    const roomExists = manageRooms.roomExists(roomName);
    socket.emit('room:exists', { exists: roomExists });
  });

  socket.on('room:create', function (data) {
    const roomName = data.roomName;
    manageRooms.createRoom(roomName);
    manageRooms.addUserToRoom(roomName, name);
    socket.join(roomName);
    socket.emit('room:exists', { exists: true });
    socket.broadcast.emit('room:update', { rooms: Object.keys(rooms) });
  });

  socket.on('join:room', function (roomName) {
    manageRooms.addUserToRoom(roomName, name);
    socket.join(roomName);

    // Check if the room exists before accessing its messages
    if (rooms[roomName]) {
      socket.emit('load:messages', rooms[roomName].messages || []);
      socket.to(roomName).emit('user:join', { name: name });
    } else {
      // If the room doesn't exist, create it and send an empty message array
      manageRooms.createRoom(roomName);
      socket.emit('load:messages', []);
    }
  });

  socket.on('disconnect', function () {
    socket.broadcast.emit('user:left', {
      name: name
    });
    userNames.free(name);

    for (const roomName in rooms) {
      manageRooms.removeUserFromRoom(roomName, name);
    }
  });
};