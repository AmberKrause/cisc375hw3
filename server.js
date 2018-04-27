//Sets up the requirement to use
var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');
var https = require('https');
//Sets up Modules for use
var express = require('express');
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var validator = require('express-validator');
var querystring = require('querystring');

var app = express();
var port = 3000;

//ArraySets
var sqlHolder = [];
var sqlTitleArray = [];
var sqlTitlePrincipalsArray = [];
var sqlPeopleArray = [];
var posterImage;

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
        if(req.body.filter === 'on') {
          var sql = 'SELECT tconst, primary_title, title_type, start_year, end_year FROM Titles WHERE primary_title LIKE "' + search_text + '" AND title_type = "' + req.body.type +'";';
        } else {
          var sql = 'SELECT tconst, primary_title, title_type, start_year, end_year FROM Titles WHERE primary_title LIKE "' + search_text + '";';
        }
				console.log(sql);
			}
			else if(req.body.category === 'person')
			{
				console.log('person entered');
        if(req.body.filter === 'on') {
          var sql = 'SELECT nconst, primary_name, primary_profession, birth_year, death_year FROM Names WHERE primary_name LIKE "' + search_text + '" AND primary_profession LIKE "%' + req.body.profession +'%";';
        } else {
          var sql = 'SELECT nconst, primary_name, primary_profession, birth_year, death_year FROM Names WHERE primary_name LIKE "' + search_text + '";';
        }
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

app.post('/updateTitle', (req, res) => {
  //console.log(req.headers);
  console.log(req.body);
  var sql;
  if(req.body.type != 'noChange') {
    sql = 'UPDATE Titles SET title_type = "' + req.body.type + '" WHERE tconst = "' + req.body.tconst + '"'
    console.log(sql);
    updateData(sql);
  }
  if(req.body.genreChange != 'noChange') {
    //get current genres
    sql = 'SELECT genres FROM Titles WHERE tconst = "' + req.body.tconst + '"'
    var myPromise = new Promise(function(resolve, reject) {
      var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
         if(err) {
           console.error(err.message);
         }//if(err) end
       });//dbs end
       dbs.get(sql, [], (err, row) => {
         if(err) {// logs error
           console.log(err);
         }//if(err)
         else {
           var currentGenres = row.genres;
           resolve(currentGenres);
           console.log(currentGenres);
         }
      });//dbs end
      dbs.close();
    });

    myPromise.then((currentGenres) => {
      if(req.body.genreChange == 'add') {
        currentGenres = currentGenres.split(",");
        console.log(currentGenres);
        if(currentGenres.indexOf(req.body.genre) < 0) {
          currentGenres.push(req.body.genre);
          console.log(currentGenres);
          currentGenres = currentGenres.filter(function(val) { return val; }).join(",");
          console.log(currentGenres);
          sql = 'UPDATE Titles SET genres = "' + currentGenres + '" WHERE tconst = "' + req.body.tconst + '"'
          updateData(sql);
          console.log("add genre: " + req.body.genre);
        }
      }
      else {
        currentGenres = currentGenres.split(",");
        var index = currentGenres.indexOf(req.body.genre);
        if(index >= 0) {
          currentGenres.splice(index, 1);
          console.log(currentGenres);
          sql = 'UPDATE Titles SET genres = "' + currentGenres + '" WHERE tconst = "' + req.body.tconst + '"'
          updateData(sql);
        }
        console.log("remove genre: " + req.body.genre);
      }
    }).catch(function(err) {
        console.log('Could not update genre: ' + err.message);
    });

  }
  for(var key in req.body) {
      if(key.substring(0, 2) === 'nm') {
        req.sanitizeBody(key).trim();
        req.sanitizeBody(key).escape();
        req.sanitizeBody(key).blacklist('\\(\\)\\;');
        var value = req.body[key];
        console.log(key + ": " + value);
        value = parseInt(value);
        if(!isNaN(value)) {
          sql = 'UPDATE Principals SET ordering = ' + value + ' WHERE tconst = "' + req.body.tconst + '" AND nconst = "' + key + '"'
          console.log(sql);
          updateData(sql);
        }
      }
  }

});//app.post end

app.post('/updateName', (req, res) => {
  console.log(req.body);
  var sql;
  req.sanitizeBody('birth_year').trim();
  req.sanitizeBody('birth_year').escape();
  req.sanitizeBody('birth_year').blacklist('\\(\\)\\;');
  req.sanitizeBody('death_year').escape();
  req.sanitizeBody('death_year').blacklist('\\(\\)\\;');
  var birth = parseInt(req.body.birth_year);
  var death = parseInt(req.body.death_year);
  if(!isNaN(birth)) {
    //update birth year
    sql = 'UPDATE Names SET birth_year = ' + birth + ' WHERE nconst = "' + req.body.nconst + '";';
    console.log(sql);
    updateData(sql);
  }
  if(!isNaN(death)) {
    //update death year
    sql = 'UPDATE Names SET death_year = ' + death + ' WHERE nconst = "' + req.body.nconst + '";';
    console.log(sql);
    updateData(sql);
  } else if(req.body.death_year.length > 0 && req.body.death_year.trim() === '') {
    //set death year to null if they enter whitespace
    sql = 'UPDATE Names SET death_year = null WHERE nconst = "' + req.body.nconst + '";';
    console.log(sql);
    updateData(sql);
  }
  if(req.body.professionChange != 'noChange') {
    sql = 'SELECT primary_profession FROM Names WHERE nconst = "' + req.body.nconst + '"'
    var myPromise = new Promise(function(resolve, reject) {
      var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
         if(err) {
           console.error(err.message);
         }//if(err) end
       });//dbs end
       dbs.get(sql, [], (err, row) => {
         if(err) {// logs error
           console.log(err);
         }//if(err)
         else {
           var currentProfs = row.primary_profession;
           resolve(currentProfs);
           console.log(currentProfs);
         }
      });//dbs end
      dbs.close();
    });

    myPromise.then((currentProfs) => {
      if(req.body.professionChange == 'add') {
        currentProfs = currentProfs.split(",");
        console.log(currentProfs);
        if(currentProfs.indexOf(req.body.profession) < 0) {
          currentProfs.push(req.body.profession);
          console.log(currentProfs);
          currentProfs = currentProfs.filter(function(val) { return val; }).join(",");
          console.log(currentProfs);
          sql = 'UPDATE Names SET primary_profession = "' + currentProfs + '" WHERE nconst = "' + req.body.nconst + '"'
          updateData(sql);
          console.log("add profession: " + req.body.profession);
        }
      }
      else {
        currentProfs = currentProfs.split(",");
        var index = currentProfs.indexOf(req.body.profession);
        if(index >= 0) {
          currentProfs.splice(index, 1);
          console.log(currentProfs);
          sql = 'UPDATE Names SET primary_profession = "' + currentProfs + '" WHERE nconst = "' + req.body.nconst + '"'
          updateData(sql);
        }
        console.log("remove profession: " + req.body.profession);
      }
    }).catch(function(err) {
        console.log('Could not update profession: ' + err.message);
    });
  }
});//app.post end


//New Get 4-22-18
//UPDATED CODE BY NOU
app.get('/title', function(req, res){
  var titlePromise = getExtendData(req.query.id);
  var peoplePromise = getTitlePrincipalData(req.query.id);
  var posterImagePromise = posterDataFunction (req.query.id);
  console.log(posterImagePromise+' 123456');
  Promise.all([titlePromise, peoplePromise, posterImagePromise]).then(function(values){//promise
    res.render('title', {
        sqlTitleArray: values[0],
            sqlTitlePrincipalsArray: values[1],
            moviePoster: values[2]
    });//res.render end
    //console.log(values);
    //console.log(values[0]);
    console.log('Title Array'+' '+values[0]+' Title Principals Array: '+values[1]);
  });//getExtendedData end
})//app.get end


app.get('/person', function(req, res){
    var personPromise = getPersonData(req.query.id);
    var personPosterPromise = posterPersonDataFunction(req.query.id)
  Promise.all([personPromise, personPosterPromise]).then(function(values){//promise
    res.render('person', {
      sqlPeopleArray: values[0],
            personPoster: values[1]
    });//res.render end
    console.log('People Array'+sqlPeopleArray)
  });//getExtendedData end
})//app.get end

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

//Updated 4/25/18
function getExtendData(inputID) {
    //var rowlength; //to hold rowlength
    //var currentrowlength = 0; //to hold current row

    var sqlItem = 'SELECT Titles.tconst AS tconst, primary_title, title_type, start_year, end_year, runtime_minutes, genres, average_rating, num_votes, directors, writers FROM (SELECT * FROM Titles WHERE tconst="'+inputID+'") AS Titles LEFT OUTER JOIN Ratings ON Titles.tconst=Ratings.tconst LEFT OUTER JOIN Crew ON Titles.tconst=Crew.tconst';
    sqlTitleArray = []; //resets the sqlHolder array to be empty so data doesn't repeat

     var myPromise = new Promise(function(resolve, reject) {
       var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
          if(err) {
            return console.error(err.message);
             }//if(err) end
        });//dbs end
        console.log(sqlItem);
        dbs.get(sqlItem, [], (err, row) => {
          console.log(row);
          if(err) {// logs error
            console.log(err);
          }//if(err)

          //reject promise if no rows to prevent infinite loop
          if(row === null) {reject('Unsuitable Data for usage because of 0 length!');}
          //fill sqlHolder with data
          if(row){
            sqlTitleArray = {
                tconst: row.tconst,
                primary_title: row.primary_title,
                title_type: row.title_type,
                start_year: row.start_year,
                end_year: row.end_year,
                runtime_minutes: row.runtime_minutes,
                genres: row.genres,
                average_rating: row.average_rating,
                num_votes: row.num_votes,
                directors: row.directors,
                writers: row.writers,
                directorsNamed: getCastNames(row.directors),
                writersNamed: getCastNames(row.writers)
            }}
            else {
              sqlTitleArray = {
                tconst: inputID,
                primary_title: inputID+' No Data',
                title_type: '',
                start_year: '',
                end_year: '',
                runtime_minutes: '',
                genres: '',
                average_rating: '',
                num_votes: '',
                directors: '',
                writers: '',
                directorsNamed: '',
                writersNamed: ''
            }
            }
            resolve(sqlTitleArray);
            console.log('Done Title Data');
            //Resolving and Rejecting if statements, to determine wait for data
        //});//forEach
      });//dbs end
      dbs.close();
     });//Promise End
  return myPromise;

}//getExtendedData End


//New function 4-22-18
function getTitlePrincipalData(inputID) {
    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var sqlItem = 'SELECT Titles.tconst AS tconst, ordering, Principals.nconst AS nconst, category, primary_name FROM (SELECT * FROM Titles WHERE tconst='+'"'+inputID+'") AS Titles LEFT OUTER JOIN Principals ON Titles.tconst=Principals.tconst LEFT OUTER JOIN Names ON Principals.nconst=Names.nconst ORDER BY ordering';
    sqlTitlePrincipalsArray = []; //resets the sqlHolder array to be empty so data doesn't repeat

	   var myPromise = new Promise(function(resolve, reject) {
	     var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
	        if(err) {
            return console.error(err.message);
             }//if(err) end
	      });//dbs end
	      //console.log(sqlItem);
        dbs.all(sqlItem, [], (err, rows) => {
          if(rows === undefined) {
            reject('No query results');
          }
          console.log(rows);
        	//console.log('rowlength = rows.length')

        	if(err) {// logs error
            console.log(err);
        	}//if(err)

          var rowlength = rows.length;
    			//reject promise if no rows to prevent infinite loop
    			if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}
    			//fill sqlHolder with data

    			rows.forEach((row) => { currentrowlength += 1;
    				sqlTitlePrincipalsArray.push({
    					  tconst: row.tconst,
    				    ordering: row.ordering,
    				    nconst: row.nconst,
    				    category: row.category,
                primary_name: row.primary_name
    				});//sql push

            if(currentrowlength == rowlength) { resolve(sqlTitlePrincipalsArray); console.log('Done Principals Data for Title'); }

          });//forEach
      });//dbs end
      dbs.close();
	   });//Promise End
	return myPromise;


}//getTitlePrincipalData End




//Updated 4/25/18
function getPersonData(inputID) {

    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var sqlItem = 'SELECT nconst, primary_name, birth_year, death_year, primary_profession, known_for_titles FROM Names WHERE nconst='+'"'+inputID+'"';
    sqlPeopleArray = []; //resets the sqlHolder array to be empty so data doesn't repeat
    console.log(sqlItem);
    console.log(sqlPeopleArray+'Before dbs');

  var myPromise = new Promise(function(resolve, reject) {
    var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
      if(err) {
        return console.error(err.message);
      }//if(err) end
    });//dbs end

        dbs.all(sqlItem, [], (err, rows) => {
          console.log(rows);
          console.log('rowlength = rows.length')
          var rowlength = rows.length;
          if(err) {// logs error
            console.log(err);
          }//if(err)

      //reject promise if no rows to prevent infinite loop
      if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}

      //fill sqlHolder with data from each row
      rows.forEach((row) => { currentrowlength += 1;
        sqlPeopleArray.push({
          nconst: row.nconst,
          primary_name: row.primary_name,
          primary_profession: row.primary_profession,
          birth_year: row.birth_year,
          death_year: row.death_year,
          known_for_titles: row.known_for_titles,
          known_for_titles2: getTitleNames(row.known_for_titles)
        });//sql push

            if(currentrowlength == rowlength) { resolve(sqlPeopleArray); console.log('Done Person Data');}
            //Resolving and Rejecting if statements, to determine wait for data
        });//forEach
    });//dbs end
    dbs.close();
    console.log(sqlPeopleArray+'after dbs')
  });//Promise End
  return myPromise;
}//getPersonData End

//UPDATED CODE BY NOU
function posterDataFunction(title_id) {
    var myPromise = new Promise(function(resolve, reject) {
        var req_url = {
        host: 'www.imdb.com',
        path: '/title/' + title_id + '/'
    };
    var req = https.request(req_url, (res) => {
        var body = '';
        res.on('data', (chunk) => {
            body += chunk;
        });
        res.on('end', () => {

            var poster_link_pos = body.indexOf('<a href="/title/' + title_id + '/mediaviewer/');
            var poster_img_pos = body.indexOf('<img', poster_link_pos);
            var poster_src_pos = body.indexOf('src=', poster_img_pos) + 5;
            var poster_end_pos = body.indexOf('"', poster_src_pos);

            var poster_url = url.parse(body.substring(poster_src_pos, poster_end_pos));
            if (poster_url.host !== null) {
                posterImage = {host: poster_url.host, path: poster_url.pathname};
                console.log(posterImage+' adasdasdasda');
                resolve(posterImage);
            }
            else {
                posterImage = '/default_poster.jpg';
                console.log('poster not found');
                resolve(posterImage);
            }
        });
    });

    req.on('error', (err) => {
        console.log(err);
    });

    

    req.setTimeout(5000);
    req.end();
    });//Promise End
    return myPromise;
}//End

function posterPersonDataFunction(name_id) {
    var myPromise = new Promise(function(resolve, reject) {
        var req_url = {
        host: 'www.imdb.com',
        path: '/name/' + name_id + '/'
    };
    var req = https.request(req_url, (res) => {
        var body = '';
        res.on('data', (chunk) => {
            body += chunk;
        });
        res.on('end', () => {
            var poster_link_pos = body.indexOf('<a href="/name/' + name_id + '/mediaviewer/');
            var poster_img_pos = body.indexOf('<img', poster_link_pos);
            var poster_src_pos = body.indexOf('src=', poster_img_pos) + 5;
            var poster_end_pos = body.indexOf('"', poster_src_pos);
            var poster_url = url.parse(body.substring(poster_src_pos, poster_end_pos));
            if (poster_url.host !== null) {
                posterImage = {host: poster_url.host, path: poster_url.pathname};
                console.log(posterImage+' personDataFunction');
                resolve(posterImage);}
            else {
                posterImage = '/default_poster.jpg';
                console.log('poster not found');
                resolve(posterImage);
            }
        });
    });

    req.on('error', (err) => {
        console.log(err);
    });

    req.setTimeout(5000);
    req.end();
    });//Promise End
    return myPromise;
}//End
function getTitleNames(names) {
    var rowlength; //to hold rowlength
    var currentrowlength = 0;
    var nameSplit = names.split(',');
    var nameBlock = [];
    var sqlItem;

    nameSplit.forEach((nameItem) => {
    sqlItem = 'SELECT tconst, primary_title FROM Titles WHERE tconst = "'+nameItem+'"';

        var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
            if(err) {
                return console.error(err.message);
            }//if(err) end
        });//dbs end

        dbs.all(sqlItem, [], (err, rows) => {
            var rowlength = rows.length;
            if(err) {// logs error
                console.log(err);
            }//if(err)

            //reject promise if no rows to prevent infinite loop
            if(rowlength < 1) { currentrowlength = 1; rowlength = 1;

            }
            else {
                //fill sqlHolder with data from each row
                rows.forEach((row) => { currentrowlength += 1;
                    nameBlock.push({
                        tconst: row.tconst,
                        primary_title: row.primary_title
                    });//sql push
                });//forEach
            }//else

            //if(currentrowlength == rowlength) { resolve(sqlPeopleArray); console.log('Done Person Data');}

        });//dbs.all
    dbs.close();
});
    return nameBlock;
}

function getCastNames(names) {
    console.log(names+'getCastNames check');
    var rowlength; //to hold rowlength
    var currentrowlength = 0;
    var nameSplit;
    if(names) {nameSplit = names.split(',');}
    else {nameSplit = ('none,none').split(',');}
    var nameBlock = [];
    var sqlItem;
    nameSplit.forEach((nameItem) => {
    sqlItem = 'SELECT nconst, primary_name FROM Names WHERE nconst = "'+nameItem+'"';

        var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
            if(err) {
                return console.error(err.message);
            }//if(err) end
        });//dbs end

        dbs.all(sqlItem, [], (err, rows) => {
            var rowlength = rows.length;
            if(err) {// logs error
                console.log(err);
            }//if(err)

            //reject promise if no rows to prevent infinite loop
            if(rowlength < 1) { currentrowlength = 1; rowlength = 1;

            }
            else {
                //fill sqlHolder with data from each row
                rows.forEach((row) => { currentrowlength += 1;
                    nameBlock.push({
                        nconst: row.nconst,
                        primary_name: row.primary_name
                    });//sql push
                    console.log(row.nconst+' '+row.primary_name);
                });//forEach
            }//else

            //if(currentrowlength == rowlength) { resolve(sqlPeopleArray); console.log('Done Person Data');}

        });//dbs.all
    dbs.close();
});
    return nameBlock;
}
//END UPDATED CODE BY NOU

function updateData(sql) { //gets the SQL data
  var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
		if(err) {
			return console.error(err.message);
		}
	});

  dbs.run(sql, [], (err) => {
    if(err) {
      return console.error(err.message);
    }
  });

  console.log('Row updated');
  dbs.close();
}//getData end










//area for test queriesvar dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
/*var sqlItem = 'SELECT DISTINCT primary_profession FROM Names';
var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {


   if(err) {
     return console.error(err.message);
      }//if(err) end
 });//dbs end
 console.log(sqlItem);

 dbs.all(sqlItem, [], (err, rows) => {
   //console.log(rows);
   console.log('rowlength = rows.length')
   var rowlength = rows.length;
   if(err) {// logs error
     console.log(err);
   }//if(err)


   profs = [];
   rows.forEach((row) => {
     //console.log(row.primary_profession);
     row_profs = row.primary_profession;
     row_profs = row_profs.split(",")
     row_profs.forEach((item) => {
       profs.push(item);
     })

   });//forEach

   var uniqueArray = profs.filter(function(item, pos) {
     return profs.indexOf(item) == pos;
   })
   console.log(uniqueArray);
});//dbs end*/
