var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');

//from npm
var express = require('express');
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var validator = require('express-validator');

var app = express();
var port = 8008;


//open the database
var db = new sqlite3.Database('./imdb.sqlite3', (err) => {
	if(err) {
		return console.error(err.message);
	}
});

//query test
/*
var sql = 'SELECT DISTINCT primary_title FROM Titles';

db.all(sql, [], (err, rows) => {
	if(err) {
		console.log('query error');
	}
	rows.forEach((row) => {
		console.log(row.primary_title);
	});
});
*/

//middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(validator());

//view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//set static path
app.use(express.static(path.join(__dirname, 'public')));


//POST request from search form in index.html
app.post('/search', (req, res) => {
    console.log(req.headers);
    console.log(req.body);

    //validate form input
    //req.checkBody('search-text', 'Enter text to search').trim().isLength({min: 1});
    req.sanitizeBody('search-text').trim();
    req.sanitizeBody('search-text').escape();
    req.sanitizeBody('search-text').blacklist('\\(\\)\\;');
    var errors = req.validationErrors();
    if (errors) {
    } else {
        //send results page
        console.log(req.body);
        res.render('results');
    }

});

app.listen(port, () => {
	console.log('Now listening on port ' + port);
});


