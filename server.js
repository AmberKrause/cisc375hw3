//Sets up the requirement to use
var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');

//Sets up Modules for use
var express = require('express');
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var validator = require('express-validator');

var app = express();
var port = 3000;

//ArraySets
var sqlHolder = [
    {
        primary_title: 'row.primary_title',
        title_type: 'row.title_type',
        start_year: 'row.start_year',
        end_year: 'row.end_year',
        runtime_minutes: 'row.runtime_minutes',
        genres: 'row.genres'
    }
    ]



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

//middleware, required to use the modules
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
//app.use(validator());
app.use(validator({
    errorFormatter: function(param, msg, value, location) {
        var namespace = param.split('.'),
        root = namespace.shift(),
        formParam = root;

        while(namespace.length) {
            formParam += '['+namespace.shift()+']';
        }
        return {
            param: formParam,
            msg: msg,
            value: value
        };
    }
}));//validator

//view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//set static path
app.use(express.static(path.join(__dirname, 'public')));


//POST request from search form in index.html
app.post('/search', (req, res) => {
    req.checkBody('search_text', 'Please provide something to search').notEmpty();

    var sqlSearch = [ //Just a testing variable to print onto results page
        {
        search_text: req.body.search_text,
        category: req.body.category
        }]

    //use the req.body.x in conjunction with SQL statements below
    //to possibly make user search possible
    var sql = 'SELECT * FROM Titles LIMIT 50';

    console.log(req.headers);
    console.log(req.body);

    //validate form input
    //req.checkBody('search-text', 'Enter text to search').trim().isLength({min: 1});
    req.sanitizeBody('search_text').trim();
    req.sanitizeBody('search_text').escape();
    req.sanitizeBody('search_text').blacklist('\\(\\)\\;');
    var errors = req.validationErrors();
    if (errors) { //Sends to an Error Page, telling you what is wrong
        console.log(errors)
        res.render('resultsError', {
            errors: errors
        });//res.render end
    }//if(errors)

    else 
    { //Correct input sends you to the results page

        console.log(sqlSearch);
        getData(sql, 'GET').then(function(sqlHolder) {//promise
            //Promise doesn't work correctly, need to refresh
            //to show the data, else the query works

            res.render('results', { //prints out sql to results page
            sqlHolder: sqlHolder
            });//res.render end
            return sqlHolder;
        });//getData promise end
    }//else

});//app.post end

app.listen(port, () => {
	console.log('Now listening on port ' + port);
});//app.listen end

function getData(sql, method) { //gets the SQL data
    var sqlItem = sql;
    var myPromise = new Promise(function(resolve, reject) {

        var dbs = new sqlite3.Database('./imdb.sqlite3');

        dbs.all(sqlItem, [], (err, rows) => {
        if(err) {
            console.log(err);
        }//if(err)
        rows.forEach((row) => { console.log(row);
            sqlHolder.push('results', {
            //set Var name: actual variable
            //for results: data for results
            primary_title: row.primary_title,
            title_type: row.title_type,
            start_year: row.start_year,
            end_year: row.end_year,
            runtime_minutes: row.runtime_minutes,
            genres: row.genres
        });//sql push
        });//forEach
    });//dbs end
    dbs.close()
    resolve(sqlHolder);
    reject('No SQL');
    });//my Promise End
    return myPromise; 
}//getData end
