"use strict";
require("dotenv").config();
const express = require("express");
const myDB = require("./connection");
const passport = require("passport");
const session = require("express-session");
const routes = require('./routes.js');
const auth = require('./auth.js');
const MongoStore = require('connect-mongo')(session);
const passportSocketIo = require('passport.socketio');
const cookieParser = require('cookie-parser');
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });
const fccTesting = require("./freeCodeCamp/fcctesting.js");

const app = express();

const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.set("view engine", "pug");
app.set("views", "./views/pug");

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
    store: store,
  })
);

app.use(passport.initialize());
app.use(passport.session());

fccTesting(app);
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("users");

  let currentUsers = 0;

  io.on('connection', socket => {
    console.log('A user has connected');
    
    ++currentUsers;
    io.emit('user', {
      username: socket.request.user.username,
      currentUsers,
      connected: true
    });
    
    socket.on('disconnect', () => {
      --currentUsers;
      io.emit('user', {
        username: socket.request.user.username,
        currentUsers,
        connected: false
      });
    });

    socket.on('chat message', (data) => {
      io.emit('chat message', {
        username: socket.request.user.username,
        message: data
      });
    })
  });
  
  routes(app, myDataBase);
  auth(app, myDataBase);
}).catch((e) => {
  console.error("Database connection error:", e);
  app.route("/").get((req, res) => {
    res.render("index", {
      title: "Error",
      message: "Unable to connect to the database.",
    });
  });
});

function onAuthorizeSuccess(data, accept) {
  console.log('successful connection to socket.io');
  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});
