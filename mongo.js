const mongodb = require("mongodb").MongoClient;
const db_url = `mongodb://arvind:arvind1@ds229826.mlab.com:29826/tinder`;
const dbName = "tinder";
const userCollection = "users";

module.exports = {
  connect: function(callback) {
    let self = this;
    return new Promise(function(resolve, reject) {
      mongodb.connect(db_url, function(err, database) {
        if (err) throw err;
        self.obj = database.db(dbName);
        if (callback) callback();
        resolve();
      });
    });
  },

  signUp: function(email, password, image, callback) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.obj.collection(userCollection).insertOne(
        {
          email: email,
          password: password,
          image: image,
          blocked: []
        },
        function(err, res) {
          if (err) throw err;
          if (callback) callback();
          resolve();
        }
      );
    });
  },

  signIn: function(email, password, callback) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.obj.collection(userCollection).findOne(
        {
          email: email,
          password: password
        },
        function(err, res) {
          if (err) throw err;

          if (res) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
    });
  },

  blockUser: function(myemail, blockemail, callback) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.obj.collection(userCollection).update(
        {
          email: myemail
        },
        {
          $push: { blocked: blockemail }
        },
        function(err, res) {
          if (err) throw err;
          if (callback) callback;
          resolve(true);
        }
      );
    });
  },

  fetchListOfUsers(myemail, callback) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.obj
        .collection(userCollection)
        .findOne({ email: myemail }, function(err, res) {
          if (err) throw err;
          console.log(res);
          let blocked = res.blocked;
          blocked.push(myemail);
          console.log("blocked" + blocked);
          self.obj
            .collection(userCollection)
            .find(
              { email: { $nin: blocked } }
            )
            .toArray(function(err, res) {
              if (err) throw err;
              res.forEach(function (ele) {
                 delete ele._id;
                 delete ele.password;
                 delete ele.blocked;
              });
              if (callback) callback(res);
              resolve(res);
            });
        });
    });
  },

  fetchMyImage(myemail, callback){
    let self = this;
    return new Promise(function (resolve, reject) {
      self.obj.collection(userCollection).findOne({
        email : myemail
      }, function (err, res) {
        if(err) throw err;
        if(callback) callback(res.image);
        resolve(res.image);
      })
    });
  }
};
