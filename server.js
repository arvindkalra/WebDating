const express = require("express");
const app = express();
const port = process.env.PORT || 2000;
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const mongo = require("./mongo");
const jwtSecret = "worldisfullofdevelopers";
const server = require("http").createServer(app);
const io = require("socket.io").listen(server);
const fs = require("fs");
const morgan = require("morgan");
const multer = require("multer");

app.set("view engine", "hbs");
app.set("views", __dirname + "/public_static");
// app.use('/', express.static(__dirname + 'public_static'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(morgan("dev"));

// app.use("/", express.static("public_static"));
app.get("/", function(req, res) {
  res.render("index");
});

let storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    cb(null, req.body.email + ".jpg"); //Appending .jpg
  }
});

let upload = multer({ storage: storage });

app.post("/login", function(req, res) {
  let email = req.body.email;
  let password = req.body.password;
  mongo.signIn(email, password).then(function(bool) {
    if (bool) {
      let token = jwt.sign({ email: email }, jwtSecret, {
        expiresIn: "24h" // expires in 24 hours
      });
      res.send({
        done: true,
        token: token
      });
    } else {
      res.send({
        done: false,
        message: "Invalid Credentials"
      });
    }
  });
});

app.post("/signup", upload.single("image"), function(req, res) {
  let email = req.body.email;
  let password = req.body.password;
  console.log(email);
  let image = `/dp/${email}`; // TODO store image
  mongo.signUp(email, password, image).then(function() {
    let token = jwt.sign({ email: email }, jwtSecret, {
      expiresIn: "24h" // expires in 24 hours
    });
    res.send({
      done: true,
      token: token
    });
  });
});

app.get("/dashboard/:email", function(req, res) {
  let email = req.params.email;
  console.log('hell', email)
  mongo.fetchListOfUsers(email).then(function(array) {
    res.render("ImageView", {
      people: array,
      length:array.length,
      email: email,
      empty: array.length === 0
    });
  });
});

app.get("/dp/:email", function(req, res) {
  console.log(req.params.email);
  let img = fs.readFileSync(`./uploads/${req.params.email}.jpg`);
  res.writeHead(200, { "Content-Type": "image/gif" });
  res.end(img, "binary");
});

function checkUser(req, res, next) {
  let token = req.headers["x-access-token"] || req.headers["authorization"]; // Express headers are auto converted to lowercase
  if (token && token.startsWith("Bearer ")) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
    if (token) {
      jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
          res.send({done : false});
        } else {
          req.decoded = decoded;
          next();
        }
      });
    } else {
      res.send({done : false});
    }
  }
}

app.use(checkUser);

app.get('/test', function (req, res) {
  res.send({done : true});
});

app.post("/blockuser", function(req, res) {
  let myemail = req.body.myEmail;
  let blockemail = req.body.blockEmail;
  mongo.blockUser(myemail, blockemail).then(function() {
    res.send(true);
  });
});

let connected = [];

function socketCheckUser(socket, next) {
  if (socket.handshake.query && socket.handshake.query.token) {
    jwt.verify(socket.handshake.query.token, jwtSecret, function(err, decoded) {
      if (err) return next(new Error("Authentication error"));
      socket.decoded = decoded;
      next();
    });
  } else {
    next(new Error("Authentication error"));
  }
}

io.use(socketCheckUser).on("connection", function(socket) {
  function workOnDisconnect(socket) {
    socket.on("disconnect", function(data) {
      let temp = connected.find(function(obj) {
        return obj.socket.id === socket.id;
      });
      console.log("disconnecting", temp.email);
      let i = connected.indexOf(temp);
      connected.splice(i, 1);
    });
  }

  console.log(socket.id, 'socket Id');

  socket.on("login", function(email) {
    console.log(email, ' connected');
    connected.push({ email: email, socket: socket });
    workOnDisconnect(socket);
  });

  socket.on("like", function(email) {
    let temp = connected.find(function(obj) {
      return obj.email === email;
    });

    if (temp) {
      temp.socket.emit("liked");
    }
  });

  socket.on("super_like", function({ myEmail, likedEmail}) {
    console.log(myEmail, likedEmail);
    let temp = connected.find(function(obj) {
      return obj.email === likedEmail;
    });
    if (temp) {
      mongo.fetchMyImage(myEmail).then(function (image) {
        console.log(image);
        temp.socket.emit("super_liked", {
          hisImage: image
        });
      });
    }
  });
});

server.listen(port, function() {
  mongo.connect().then(function() {
    console.log(`Listening on port = ${port}`);
  });
});
