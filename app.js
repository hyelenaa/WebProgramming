'use strict';

var express = require('express');
var http = require('http');
var socketHandler = require('./routes/socket.js'); // Ensure the correct path

var app = express();
var server = http.createServer(app);

/* Configuration */
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.set('port', 3000);

if (process.env.NODE_ENV === 'development') {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

/* Socket.io Communication */
var io = require('socket.io')(server);
io.on('connection', (socket) => {
    socketHandler(socket, io); // Pass the io instance
});

/* Start server */
server.listen(app.get('port'), function () {
    console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
