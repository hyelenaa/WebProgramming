'use strict';

var React = require('react');
var socket = io.connect();

var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

var request = indexedDB.open("myDatabase", 3);

var db;

request.onerror = function(event) {
  console.error("Database error: " + event.target.errorCode);
};

request.onsuccess = function(event) {
  db = event.target.result;
  console.log("Database opened successfully");
};

request.onupgradeneeded = function(event) {
  var db = event.target.result;
  if (!db.objectStoreNames.contains("users")) {
    db.createObjectStore("users", { keyPath: "username" });
  }
  if (!db.objectStoreNames.contains("rooms")) {
    var roomStore = db.createObjectStore("rooms", { keyPath: "roomname" });
    roomStore.createIndex("messages", "messages", { unique: false });
  }
};

function addUser(username, password) {
  var transaction = db.transaction(["users"], "readwrite");
  var objectStore = transaction.objectStore("users");
  var request = objectStore.add({ username: username, password: password });

  request.onsuccess = function(event) {
    console.log("User added to database successfully");
  };

  request.onerror = function(event) {
    console.error("Failed to add user to database: ", event.target.error);
  };
}

function getUser(username) {
  return new Promise(function(resolve, reject) {
    var transaction = db.transaction(["users"], "readonly");
    var objectStore = transaction.objectStore("users");
    var request = objectStore.get(username);

    request.onsuccess = function(event) {
      var user = event.target.result;
      resolve(user);
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function getRoom(roomname, callback) {
  var transaction = db.transaction(["rooms"], "readonly");
  var objectStore = transaction.objectStore("rooms");
  var request = objectStore.get(roomname);

  request.onsuccess = function(event) {
    var room = event.target.result;
    callback(null, room);
  };

  request.onerror = function(event) {
    callback(event.target.error, null);
  };
}

function addRoom(roomname, callback) {
  var transaction = db.transaction(["rooms"], "readwrite");
  var objectStore = transaction.objectStore("rooms");
  var request = objectStore.add({ roomname: roomname, messages: [] });

  request.onsuccess = function(event) {
    alert('채팅방이 성공적으로 생성됐습니다!');
    callback(null);
  };

  request.onerror = function(event) {
    callback(event.target.error);
  };
}

function addMessageToRoom(roomname, message, callback) {
  var transaction = db.transaction(["rooms"], "readwrite");
  var objectStore = transaction.objectStore("rooms");
  var request = objectStore.get(roomname);

  request.onsuccess = function(event) {
    var room = event.target.result;
    if (!room) {
      room = { roomname: roomname, messages: [] };
    }
    room.messages.push(message);
    var updateRequest = objectStore.put(room);

    updateRequest.onsuccess = function(event) {
      callback(null);
    };

    updateRequest.onerror = function(event) {
      callback(event.target.error);
    };
  };

  request.onerror = function(event) {
    callback(event.target.error);
  };
}

function getMessagesFromRoom(roomname) {
  return new Promise(function(resolve, reject) {
    var transaction = db.transaction(["rooms"], "readonly");
    var objectStore = transaction.objectStore("rooms");
    var request = objectStore.get(roomname);

    request.onsuccess = function(event) {
      var room = event.target.result;
      resolve(room ? room.messages : []);
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

var Modal = React.createClass({
  render() {
    if (!this.props.show) {
      return null;
    }

    return (
      <div id="myModal" className="modal" style={{ display: "block" }}>
        <div className="modal-content">
          <span className="close" onClick={this.props.onClose}>&times;</span>
          <p>{this.props.message}</p>
        </div>
      </div>
    );
  }
});

var LoginForm = React.createClass({
  getInitialState() {
    return { username: '', password: '', errorMessage: '', showModal: false };
  },

  handleUsernameChange(e) {
    this.setState({ username: e.target.value });
  },

  handlePasswordChange(e) {
    this.setState({ password: e.target.value });
  },

  handleSubmit(e) {
    e.preventDefault();
    var username = this.state.username.trim();
    var password = this.state.password.trim();
    if (!username || !password) {
      this.setState({ errorMessage: '아이디와 비밀번호를 입력하세요.', showModal: true });
      return;
    }

    getUser(username)
      .then(function(user) {
        if (user && user.password === password) {
          this.props.onLogin(username);
        } else {
          this.setState({ errorMessage: '아이디 또는 비밀번호가 올바르지 않습니다.', showModal: true });
        }
      }.bind(this))
      .catch(function(error) {
        console.error("Failed to retrieve user: ", error);
        this.setState({ errorMessage: '오류가 발생했습니다. 다시 시도해주세요.', showModal: true });
      }.bind(this));
  },

  closeModal() {
    this.setState({ showModal: false });
  },

  render() {
    return (
      <div className="login-background-box">
        <div className="login-form">
          <img src="/images/Fire.png" className="fire-image" alt="Fire Image" />
          <h2 className="login-text">로그인</h2>
          <form onSubmit={this.handleSubmit}>
            <input
              type='text'
              placeholder='아이디'
              value={this.state.username}
              onChange={this.handleUsernameChange}
              className="input-box"
            />
            <input
              type='password'
              placeholder='비밀번호'
              value={this.state.password}
              onChange={this.handlePasswordChange}
              className="input-box"
            />
            <div className="button-container">
              <button type='submit' className="login-button login-button-text">로그인</button>
              <button type='button' onClick={this.props.onSignupClick} className="signup-button signup-button-text">회원가입</button>
            </div>
            <Modal show={this.state.showModal} message={this.state.errorMessage} onClose={this.closeModal} />
          </form>
        </div>
      </div>
    );
  }
});

var SignupForm = React.createClass({
  getInitialState() {
    return { username: '', password: '', errorMessage: '', showModal: false };
  },

  handleUsernameChange(e) {
    this.setState({ username: e.target.value });
  },

  handlePasswordChange(e) {
    this.setState({ password: e.target.value });
  },

  handleSubmit(e) {
    e.preventDefault();
    var username = this.state.username.trim();
    var password = this.state.password.trim();
    if (!username || !password) {
      this.setState({ errorMessage: '아이디와 비밀번호를 입력해주세요.', showModal: true });
      return;
    }

    getUser(username)
      .then(function(user) {
        if (user) {
          this.setState({ errorMessage: '이미 등록된 아이디입니다.', showModal: true });
        } else {
          addUser(username, password);
          this.setState({ errorMessage: '회원가입에 성공했습니다!', showModal: true }, () => {
            setTimeout(() => {
              this.setState({ showModal: false });
              this.props.onSignupSuccess();
            }, 2000); // 2초 후 모달 닫기
          });
        }
      }.bind(this))
      .catch(function(error) {
        console.error("Failed to retrieve user: ", error);
        this.setState({ errorMessage: '오류가 발생했습니다. 다시 시도해주세요.', showModal: true });
      }.bind(this));
  },

  closeModal() {
    this.setState({ showModal: false });
  },

  render() {
    return (
      <div className="signup-background-box">
        <div className="signup-form">
          <img src="/images/Fire.png" className="fire-image" alt="Fire Image" />
          <h2 className="signup-text">회원가입</h2>
          <form onSubmit={this.handleSubmit}>
            <input
              type="text"
              placeholder="아이디"
              value={this.state.username}
              onChange={this.handleUsernameChange}
              className="input-box"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={this.state.password}
              onChange={this.handlePasswordChange}
              className="input-box"
            />
            <div className="button-container">
              <button type="button" onClick={this.props.onBack} className="previous-button previous-button-text">뒤로</button>
              <button type="submit" className="signup-button signup-button-text">회원가입</button>
            </div>
            <Modal show={this.state.showModal} message={this.state.errorMessage} onClose={this.closeModal} />
          </form>
        </div>
      </div>
    );
  }
});

var RoomSearchForm = React.createClass({
  getInitialState() {
    return { roomName: '' };
  },

  handleRoomNameChange(e) {
    this.setState({ roomName: e.target.value });
  },

  handleSubmit(e) {
    e.preventDefault();
    var roomName = this.state.roomName;
    if (!roomName) {
      alert('채팅방 이름을 입력하세요.');
      return;
    }
    this.props.onRoomSearch(roomName);
  },

  render() {
    return (
      <div className="room-search-form">
        <form onSubmit={this.handleSubmit}>
          <input
            type="text"
            placeholder="채팅방 이름 검색"
            value={this.state.roomName}
            onChange={this.handleRoomNameChange}
            className="input-box"
          />
          <button type="submit" className="next-button button-text">검색</button>
        </form>
      </div>
    );
  }
});

var RoomList = React.createClass({
  createRoom() {
    getRoom(this.props.searchedRoom, (err, room) => {
      if (err) {
        console.error("Failed to search room: ", err);
        return;
      }

      if (room) {
        alert('이미 존재하는 방입니다.');
        this.props.onRoomCreated(this.props.searchedRoom);
      } else {
        addRoom(this.props.searchedRoom, (err) => {
          if (err) {
            console.error("Failed to create room: ", err);
            return;
          }
          this.props.onRoomCreated(this.props.searchedRoom);
          // 방을 만든 후 검색을 다시 하여 목록에 추가
          this.props.onRoomSearch(this.props.searchedRoom);
        });
      }
    });
  },
  render() {
    const { rooms, searchedRoom, roomExists, onCancel, onRoomSelect } = this.props;

    return (
      <div className="room-list">
        {searchedRoom && !roomExists && (
          <div className="create-room-container">
            <h2 className="create-room-message">채팅방이 존재하지 않습니다. 새로 만드시겠습니까?</h2>
            <div className="create-room-buttons">
              <button onClick={this.createRoom} className="create-room-button">예</button>
              <button onClick={onCancel} className="cancel-room-button">아니오</button>
            </div>
          </div>
        )}
        {searchedRoom && roomExists && (
          <div>
            <h3>검색 결과</h3>
            <ul>
              <li onClick={() => onRoomSelect(searchedRoom)}>{searchedRoom}</li>
            </ul>
          </div>
        )}
        {!searchedRoom && (
          <div>
            <h3>채팅방 목록</h3>
            <ul>
              {rooms && rooms.map((room, i) => {
                return <li key={i} onClick={() => onRoomSelect(room)}>{room}</li>;
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }
});

var MessageList = React.createClass({
  render() {
    return (
      <div className="message-list messages">
        <ul>
          {this.props.messages.map((message, i) => (
            <li key={i} className={`message-item ${message.user === this.props.user ? 'self' : ''}`}>
              <strong>{message.user}</strong>: {message.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }
});

var MessageForm = React.createClass({
  getInitialState() {
    return { text: '' };
  },

  handleSubmit(e) {
    e.preventDefault();
    var message = {
      user: this.props.user,
      text: this.state.text,
      room: this.props.room // 현재 방 이름을 포함
    };
    this.props.onMessageSubmit(message);
    this.setState({ text: '' });
  },

  changeHandler(e) {
    this.setState({ text: e.target.value });
  },

  render() {
    return (
      <div className="message-form">
        <form onSubmit={this.handleSubmit}>
          <input
            onChange={this.changeHandler}
            value={this.state.text}
            placeholder="메시지를 입력하세요"
            className="textinput"
          />
          <button type="submit" className="send-button">보내기</button>
        </form>
      </div>
    );
  }
});


var ChatApp = React.createClass({
  getInitialState() {
    return {
      users: [],
      messages: [],
      text: '',
      username: '',
      loggedIn: false,
      signup: false,
      roomName: '',
      roomSearched: false,
      roomExists: false,
      rooms: [],
      currentRoom: null,
      searchedRoom:''
    };
  },

  componentDidMount() {
    socket.on('init', this._initialize);
    socket.on('send:message', this._messageReceive); // 메시지 수신 이벤트
    socket.on('user:join', this._userJoined);
    socket.on('user:left', this._userLeft);
    socket.on('change:name', this._userChangedName);
    socket.on('room:exists', this._roomExists);
    socket.on('load:messages', this._loadMessages);
  },

  _initialize(data) {
    var { users, name, rooms } = data;
    this.setState({ users, username: name, rooms });
  },

  _messageReceive(message) {
    if (message.room === this.state.currentRoom) { // 현재 방과 일치하는지 확인
      var { messages } = this.state;
      messages.push(message);
      this.setState({ messages });
    }
  },

  _userJoined(data) {
    var { users } = this.state;
    users.push(data.name);
    this.setState({ users });
  },

  _userLeft(data) {
    var { users } = this.state;
    var index = users.indexOf(data.name);
    users.splice(index, 1);
    this.setState({ users });
  },

  _userChangedName(data) {
    var { users } = this.state;
    var index = users.indexOf(data.oldName);
    users.splice(index, 1, data.newName);
    this.setState({ users });
  },

  _roomExists(data) {
    this.setState({ roomExists: data.exists });
  },

  _loadMessages(messages) {
    this.setState({ messages });
  },

  handleMessageSubmit(message) {
    var { messages, currentRoom } = this.state;
    this.setState({ messages });
    socket.emit('send:message', message);
    addMessageToRoom(currentRoom, message, (err) => {
      if (err) {
        console.error("Failed to add message to room: ", err);
      }
    });
  },

  handleChangeName(newName) {
    var oldName = this.state.username;
    socket.emit('change:name', { name: newName }, (result) => {
      if (!result) {
        return alert('아이디 변경 중 오류가 발생했습니다.');
      }
      var { users } = this.state;
      var index = users.indexOf(oldName);
      users.splice(index, 1, newName);
      this.setState({ users, username: newName });
    });
  },

  handleLogin(username) {
    this.setState({ username, loggedIn: true }, () => {
      socket.emit('user:login', { username });
    });
  },

  handleSignupSuccess() {
    this.setState({ signup: false });
  },

  handleSignupClick() {
    this.setState({ signup: true });
  },

  handleSignupBack() {
    this.setState({ signup: false });
  },

  handleRoomSearch(roomName) {
    getRoom(roomName, (err, room) => {
      if (err) {
        console.error("Failed to search room: ", err);
        return;
      }
      this.setState({ roomSearched: true, searchedRoom: roomName, roomExists: !!room });
    });
  },

  handleRoomCreated(roomName) {
    addRoom(roomName, (err) => {
      if (err) {
        console.error("Failed to create room: ", err);
        return;
      }
      
      this.handleRoomSearch(roomName);
    });
  },

  handleRoomSelect(roomName) {
    // IndexedDB에서 메시지 불러오기
    getMessagesFromRoom(roomName)
      .then(messagesFromDB => {
        // 서버에서 메시지 불러오기
        socket.emit('join:room', roomName);
        socket.once('load:messages', messagesFromServer => {
          const allMessages = [...messagesFromDB, ...messagesFromServer];
          this.setState({ currentRoom: roomName, messages: allMessages });
        });
      })
      .catch(err => {
        console.error("Failed to retrieve messages from room: ", err);
      });
  },

  handleCancelRoomSearch() {
    this.setState({ roomSearched: false, searchedRoom: '' });
  },

  renderRightPanel() {
    if (this.state.currentRoom) {
      return (
        <div>
          <h2>{this.state.currentRoom}</h2>
          <MessageList messages={this.state.messages} user={this.state.username} />
          <MessageForm onMessageSubmit={this.handleMessageSubmit} user={this.state.username} room={this.state.currentRoom} />
        </div>
      );
    } else {
      return (
        <div className="right-panel">
          <div className="welcome-message">
            채팅방을 검색하거나 새로 생성하세요.
          </div>
        </div>
      );
    }
  },

  render() {
    const { loggedIn, signup, roomSearched, roomExists, rooms, searchedRoom } = this.state;

    return (
      <div className="chat-app">
        {loggedIn ? (
          <div className="chat-container">
            <div className="top-panel">
              <img src="/images/INU.png" className="chatform-image" alt="Chatform Image" />
            </div>
            <div className="main-panel">
              <div className="left-panel">
              </div>
              <div className="center-panel">
                 <RoomList
                   rooms={rooms}
                   searchedRoom={searchedRoom}
                   roomExists={roomExists}
                   onRoomCreated={(roomName) => this.handleRoomCreated(roomName)}
                   onCancel={() => this.handleCancelRoomSearch()}
                   onRoomSelect={(roomName) => this.handleRoomSelect(roomName)}
                   onRoomSearch={(roomName) => this.handleRoomSearch(roomName)}
                 />
                <RoomSearchForm onRoomSearch={this.handleRoomSearch} />
 
              </div>
              <div className='right-panel'>
                {this.renderRightPanel()}
              </div>
            </div>
            
          </div>
        ) : signup ? (
          <SignupForm onSignupSuccess={this.handleSignupSuccess} onBack={this.handleSignupBack} />
        ) : (
          <LoginForm onLogin={this.handleLogin} onSignupClick={this.handleSignupClick} />
        )}
      </div>
    );
  }
});

React.render(<ChatApp />, document.getElementById('app'));