"use strict";
require("dotenv").config();
const express = require("express");
const myDB = require("./connection");
const passport = require("passport");
const session = require("express-session");
const routes = require('./routes.js');
const auth = require('./auth.js');
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
  })
);

app.use(passport.initialize());
app.use(passport.session());

fccTesting(app);
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("users");
  io.on('connection', socket => {
    console.log('A user has connected');
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});
