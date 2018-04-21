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
var sqlHolder = [];


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

app.get('/', (req, res) => {
	res.render('index', {
			errors: undefined
	});//res.render end
});

//POST request from search form in index.html
app.post('/search', (req, res) => {
    req.checkBody('search_text', 'Please provide something to search').notEmpty();

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
        res.render('index', {
            errors: errors
        });//res.render end
    }//if(errors)

    else
    { //Correct input sends you to the results page

			var search_text = req.body.search_text.replace(/\*/g, "%");//use wildcard character

			if(req.body.category === 'title')
			{
				console.log('title entered');
				var sql = 'SELECT tconst, primary_title, title_type, start_year, end_year FROM Titles WHERE primary_title LIKE "' + search_text + '";';
				console.log(sql);
			}
			else if(req.body.category === 'person')
			{
				console.log('person entered');
				var sql = 'SELECT nconst, primary_name, primary_profession, birth_year, death_year FROM Names WHERE primary_name LIKE "' + search_text + '";';
				console.log(sql);
			}

      getData(sql, req.body.category).then(function(sqlHolder) {//promise
          console.log('then function');
          res.render('results', { //prints out sql to results page
          sqlHolder: sqlHolder
          });//res.render end
          return sqlHolder;
      	}, function() {
					//rejection callback
					//gets called if the query returned no results
					console.log('query promise rejected')
					var errors = [{msg:'No results. Please try another search'}];
					res.render('index', {
	            errors: errors
	        });//res.render end
			});//getData promise end
    }//else

});//app.post end

app.listen(port, () => {
	console.log('Now listening on port ' + port);
});//app.listen end

function getData(sql, method) { //gets the SQL data
    var sqlItem = sql;
    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var myPromise = new Promise(function(resolve, reject) {
        var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
					if(err) {
						return console.error(err.message);
					}
				});
        sqlHolder = []; //resets the sqlHolder array to be empty so data doesn't repeat
        dbs.all(sqlItem, [], (err, rows) => { rowlength = rows.length; console.log(rowlength);
        if(err) {// logs error
            console.log(err);
        }//if(err)

				//reject promise if no rows to prevent infinite loop
				if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}

				//fill sqlHolder with data from each row
				rows.forEach((row) => { currentrowlength += 1;
						if(method === 'title') {

						    sqlHolder.push({
				            //set Var name: actual variable
				            //for results: data for results
										type: method,
										tconst: row.tconst,
				            primary_title: row.primary_title,
				            title_type: row.title_type,
				            start_year: row.start_year,
				            end_year: row.end_year
								});//sql push
						} else if(method === 'person') {
								sqlHolder.push({
										//set Var name: actual variable
										//for results: data for results
										type: method,
										nconst: row.nconst,
										primary_name: row.primary_name,
										primary_profession: row.primary_profession,
										birth_year: row.birth_year,
										death_year: row.death_year
								});//sql push
						}

            if(currentrowlength == rowlength) { resolve(sqlHolder); console.log('Done');}
            else if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}
            //Resolving and Rejecting if statements, to determine wait for data
        });//forEach
    });//dbs end
    dbs.close()
		});//my Promise End
    return myPromise;
}//getData end
