import Rx from 'rx';
import moment from 'moment';
import request from 'request';
import extend from 'extend';

const just = Rx.Observable.just;
const justThrow = Rx.Observable.throw;

function choose(options) {
    const randIndex = Math.floor(Math.random() * options.length);
    return options[randIndex];
}

function respond(input) {

    // TODO: this shouldn't be necessary, could be losing real information
    input = input.
        replace(/please/g, '').
        replace(/.+ thanks/g, ''). // strip thanks if not on its own
        trim();

    let m;
    if (input.match(/^(hi|hello)\s*[!?.]*$/)) {
        const greeting = choose([
            'hey',
            'heya',
            'hey there',
            'hi!',
            'hello',
        ]);
        return just(greeting);
    }
    if (input.match(/^(thanks|thank you)\s*[!?.]*$/)) {
        const nw = choose([
            'no worries',
            'you\'re welcome',
            'don\'t mention it',
            'my pleasure',
        ]);
        return just(nw);
    }
    if (input.match(/what is the time/)) {
        const now = moment();
        const time = now.format('HH:mm');
        return just(`it's ${time}`);
    }
    if (input.match(/^[-+*/0-9 ]+$/)) {
        try {
            const result = eval(input);
            if (result === NaN || result === Infinity || result === -Infinity) {
                return just('that didn\'t compute');
            } else {
                return just(result);
            }
        } catch(e) {
            return just('oops, that wasn\'t valid math');
        }
    }
    // TODO: "deerhunter review"
    // TODO: "review of the last __ album"
    // TODO: "review of the last __ film"
    // TODO: "review of the last film by __"
    // TODO: "review of the last film with __"
    // TODO: "review of the last film starring __"
    if ((m = input.match(/review of (.+)/))) {
        const [, what] = m;
        return lookupThing(what)
            .flatMap(entities => {
                // FIXME: filter reviewable entities (album, film, book)
                // FIXME: pick best/first?
                console.log(entities)
                const bestEntity = entities[0]
                // TODO: filter if in headline?
                if (bestEntity) {
                    let extraTagFilter = {
                        film: ['film/film'],
                        album: ['music/music'],
                        book: ['books/books']
                    }[bestEntity.kind] || [];
                    return findContent({
                        tag: ['tone/reviews'].concat(extraTagFilter).join(','),
                        // TODO: quote?
                        q: entities[0].name
                    });
                } else {
                    // ???
                    return justThrow('XXX');
                }
            }).map(response => {
                const contentList = response.results;
                const bestResult = contentList[0]
                if (bestResult) {
                    const {webTitle, webUrl} = bestResult;
                    return `${webTitle} ${webUrl}`;
                } else {
                    // FIXME: nothing found
                    return 'sorry, I couldn\'t find anything for you'
                }
            })
        // TODO: recover
    }
    if ((m = input.match(/an? (.+) recipe with (.+)/))) {
        const [, author, ingredientsString] = m;
        const ingredients = ingredientsString.split(/(?:, +| +and +)/);
        return findContributors(author)
            .flatMap(response => {
                const contributors = response.results;
                const bestContributor = contributors[0]
                if (bestContributor) {
                    return findContent({
                        tag: ['tone/recipes', bestContributor.id].join(','),
                        // TODO: quote?
                        q: ingredients.join(' AND ')
                    });
                } else {
                    // ???
                    return justThrow('XXX');
                }
            }).map(response => {
                const contentList = response.results;
                const bestResult = contentList[0]
                if (bestResult) {
                    const {webTitle, webUrl} = bestResult;
                    return `${webTitle} ${webUrl}`;
                } else {
                    // FIXME: nothing found
                }
            })
        // TODO: recover
    }
    if ((m = input.match(/(?:what's|what is) (.+)/))) {
        const [, concept] = m;
        return explainConcept(concept);
    }
    if ((m = input.match(/(?:who's|who is) (.+)/))) {
        const [, who] = m;
        return explainPerson(who);
    }
    // TODO: last article/opinion piece by
    // TODO: give me something funny, sad
    // TODO: how many, facts
    // TODO: follow, subscribe

    // TODO: here for fun or business? more browsing

    return just('sorry, I didn\'t get that');
}

function explainConcept(concept) {
    // TODO: lookup in concept store
    if (concept.match(/daesh/i)) {
        return just('Daesh is a derogatory appelation for ISIS, from the Arabic words Daes, "one who crushes something underfoot", and Dahes, "one who sows discord".');
    } else {
        return just('sorry I don\'t know');
    }
}

function explainPerson(person) {
    // TODO: lookup in people store
    if (person.match(/bernie sanders/i)) {
        return just('Bernard Sanders is an American Democrat and Senator from Vermont, candidate the 2016 U.S. election.');
    } else {
        return just('sorry I don\'t know');
    }
}


import xml2js from 'xml2js';

function rxParseXml(xmlString) {
    return Rx.Observable.create(observer => {
        xml2js.parseString(xmlString, (err, data) => {
            if (err) {
                observer.onError(data);
            } else {
                observer.onNext(data);
            }
            observer.onCompleted();
        });
    });
}

const DBPEDIA_SPARQL_URI = 'http://live.dbpedia.org/sparql';

function lookupPeople(people) {
    const normalisedPeople = escapeDoubleQuote(people.toLowerCase());
    return rxRequest({
        uri: DBPEDIA_SPARQL_URI,
        qs: {
            query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>

SELECT DISTINCT ?people ?type
WHERE {
  ?people dbp:name "${normalisedPeople}"@en.
  ?people a ?type.
  { ?people a dbo:Band } UNION
  { ?people a dbo:MusicalArtist } UNION
  { ?people a dbo:Writer }.
}
LIMIT 10`,
            // FIXME: director?
            format: 'json'
        }
    }).map(response => JSON.parse(response.body).results.bindings);
}


function lookupThing(thing) {
    const normalisedThing = escapeDoubleQuote(thing.toLowerCase());
    return rxRequest({
        uri: DBPEDIA_SPARQL_URI,
        qs: {
            query: `
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX dbp: <http://dbpedia.org/property/>

SELECT DISTINCT ?name ?thing ?type
WHERE {
  ?thing dbp:name ?name.
  ?thing a ?type.
  { ?thing a dbo:Film } UNION
  { ?thing a dbo:Album } UNION
  { ?thing a dbo:Book }.
  FILTER (lcase(str(?name)) = "${normalisedThing}").
}
LIMIT 30`,
            format: 'json'
        }
    }).map(response => {
        const rawResults = JSON.parse(response.body).results.bindings;
        const results = rawResults.map(result => {
            return {
                name: result.name.value,
                uri:  result.thing.value,
                type: result.type.value
            };
        });

        // group by uri, aggregate type into array
        return results.reduce((acc, result) => {
            if (! acc.some(r => r.uri == result.uri)) {
                return acc.concat({
                    name: result.name,
                    uri: result.uri,
                    types: [result.type]
                });
            } else {
                return acc.map(r => {
                    if (r.uri == result.uri) {
                        return {
                            name:  r.name,
                            uri:   r.uri,
                            types: r.types.concat(result.type)
                        };
                    } else {
                        return r;
                    }
                });
            }
        }, []).map(result => {
            return {
                name:  result.name,
                uri:   result.uri,
                types: result.types,
                kind:  result.types.indexOf('http://dbpedia.org/ontology/Film') !== -1 ? 'film' :
                    result.types.indexOf('http://dbpedia.org/ontology/Album') ? 'album' :
                    result.types.indexOf('http://dbpedia.org/ontology/Book') ? 'book' : undefined
            };
        });
    });
}

function escapeDoubleQuote(str) {
    return str.replace(/"/g, '%22');
}

// function lookup(thing) {
//     return rxRequest({
//         uri: 'http://lookup.dbpedia.org/api/search.asmx/KeywordSearch',
//         qs: {
//             // QueryClass: 'place',
//             QueryClass: 'film',
//             QueryString: thing
//         }
//     }).
//         map(response => response.body).
//         flatMap(rxParseXml).
//         map(resp => {
//             const results = resp.ArrayOfResult.Result || [];
//             return results.map(result => {
//                 const classes = result.Classes[0].Class || [];
//                 return {
//                     title: result.Label[0],
//                     description: result.Description[0].trim(),
//                     classes: classes.map(klass => {
//                         return {
//                             title: klass.Label[0],
//                             uri: klass.URI[0]
//                         };
//                     })
//                 };
//             });
//         });
// }



import {readConfig} from './conf';

const config = readConfig();

const CAPI_API_KEY = config.capiApiKey;
const CAPI_BASE_URI = config.capiBaseUri;

function findContent(params) {
    return rxRequest({
        uri: `${CAPI_BASE_URI}/search`,
        qs: extend({
            'api-key': CAPI_API_KEY,
            limit: 10
        }, params)
    }).map(response => JSON.parse(response.body).response);
}

function findContributors(name) {
    return rxRequest({
        uri: `${CAPI_BASE_URI}/tags`,
        qs: extend({
            'api-key': CAPI_API_KEY,
            type: 'contributor',
            q: name,
            limit: 3
            // FIXME: if multiple, find most popular..?
        })
    }).map(response => JSON.parse(response.body).response);
}



// Rx wrapper for Node request
// const rxRequest = Rx.Observable.fromNodeCallback(request)
function rxRequest(options) {
    return Rx.Observable.create(observer => {
        request(options, (error, response) => {
            if (error) {
                observer.onError(error);
            } else {
                observer.onNext(response);
            }
            observer.onCompleted();
        });
    });
}


function test(input) {
    const response = respond(input);
    response.subscribe(
        resp => {
            console.log(input);
            console.log(`>> ${resp}`);
        },
        error => {
            console.log(input);
            console.log(`!!!! ${error}`);
        },
        _ => {
            console.log();
        }
    );
}


// TODO: lookup authors/etc the user follows, notify of reviews, interview etc
// TODO: example of useful questions people ask
// TODO: all reviews of books by X, best first

test("hi!");
test("what is the time?");
test("2 + 2");
test("2 / 0");
test("-2 / 0");
test("--2 / 0");
test("give me a review of SPECTRE");
test("give me a review of SPECTRE please");
test("give me a review of the lobster");
test("give me a review of fading frontier");
test("give me a review of the peripheral by william gibson");
test("give me a review of the last Chvrches album");
test("do you have an ottolenghi recipe with lamb and pomegranate");
test("who is bernie sanders?");
test("what is daesh?");
test("uh");
