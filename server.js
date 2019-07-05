'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
// mongoose.connect(process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true}).then(
  () => {
    console.log("mongo opened:", process.env.MONGO_URI)    
  },
  err => {
    console.error("### error starting mongo:", process.env.MONGO_URI)
    console.error(err)
  }
);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use('/public', express.static(process.cwd() + '/public'));
app.use("/", bodyParser.urlencoded({extended:false}));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

//URL shortner DB Schema
var URLShortnerSchema = new mongoose.Schema({
  id: {type: Number, required: [true]}, 
  originalURL: String
});

var URLShortnerModel = mongoose.model('URLShortnerModel', URLShortnerSchema);

const lookupOptions ={ family: 0,
  hints: dns.ADDRCONFIG | dns.V4MAPPED};
  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {  
  res.json({greeting: 'hello API'});
});

app.get("/api/cleanDB", function(req,res){
  deleteAll(function(err, data){
    if(err)
      console.log("could not clear all data");
    res.json({Deletion: 'All records deleted '});
  });
})

//API Endpoint to shorten
app.route("/api/shorturl/new").get(function(req,res){
  console.log("GET Method "+ req.query.url);
  var short_url = '';
  res.json({"original_url":req.query.url, "short_url":short_url});
}).post(function(req,res){
  console.log("URL to shorten "+ req.body.url); 
  var original_url = req.body.url;
  var short_url = '';
  //Remove the protocol part from the url
  var original_url_wo_protocol = original_url.replace(/(^\w+:|^)\/\//, '');
  console.log("URL without protocol is "+ original_url_wo_protocol);
  //check if url is valid
  dns.lookup(original_url_wo_protocol, lookupOptions, function(err, address, family){
     if(err){
       console.log("Invalid url "+ original_url_wo_protocol);
       console.log("Error lookup "+ err);
       res.json({"error":"invalid URL"});
     }else{
       //give a shortened url
       //store it in db
       console.log('First chk if URL is already in DB '+ original_url);
       findURLIfExists(original_url, function(err, data) {
        if(err){
                res.json(err);
         }
         console.log("Did we find the url? "+ data);
         if(data == null){
           console.log("URL not yet in our DB");
           findCountOfURL(function(err, allURLCount){
             if(err){
                 console.log("Error while finding count ");
                 res.json(err);
             }
             console.log('We have '+ allURLCount + ' URLs');
             var nextShortURLId;
             if(allURLCount == null){
               nextShortURLId = 1;
             }else{
               nextShortURLId = allURLCount + 1;  
             }
             insertNewURL(original_url, nextShortURLId, function(err, queryResult){
               if(err){
                 console.log("Error while inserting ");
                 res.json(err);
               }
               res.json({"original_url":original_url,"short_url":nextShortURLId});
             })             
           })
         }else{
           console.log("We already have the URL in DB ");
           res.json({"original_url":original_url,"short_url":data.id});
         }
         
       });       
     }
  });  
});


//API Endpoint for URL re-director
app.get("/api/shorturl/:urlnum", function(req,res){
  console.log("redirect to "+ req.params.urlnum);
  
  findURLWithShortID(req.params.urlnum, function(err, queryResult){
      if(err){
          console.log("Error while fetching short id ");
          res.json(err);
      }
      console.log("Redirecting to url "+ queryResult.originalURL);
      res.writeHead(301, { "Location": + queryResult.originalURL});
      return res.end();
    })  
});

//DB Methods

var findURLIfExists = function(original_url, done) {
  console.log("Finding URL "+ original_url);
  URLShortnerModel.findOne({originalURL:original_url}, (err, data) => {
      if(err) {
         done(err); 
      }
      done(null, data);
    }) 
};

var findCountOfURL = function(done){
  console.log("Finding Total Count ");
  URLShortnerModel.countDocuments({}, function (err, count) {
    if(err) done(err)
    console.log('there are %d URLs', count);
    done(null, count);
  });
};

var insertNewURL = function(url, shortId, done){
  console.log("Inserting a New URL ");
  var myURL = new URLShortnerModel(
    {originalURL: url,
    id:shortId});
    
  myURL.save(function(err, myURL){
    if(err) return done(err);
    done(null, myURL);
  });

};

var findURLWithShortID = function(shortId, done) {
  console.log("Finding URL "+ shortId);
  URLShortnerModel.findOne({id:shortId}, (err, data) => {
      if(err) {
         done(err); 
      }
      done(null, data);
    }) 
};

var deleteAll = function(done){
  URLShortnerModel.deleteMany({}, function(err, queryResult){
      if(err)
        done(err);
      done(null, queryResult);
  })
};
app.listen(port, function () {
  console.log('Node.js listening ...');
});